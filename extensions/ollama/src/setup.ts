// Ollama setup module handles plugin onboarding behavior.
import { formatErrorMessage } from "quiet-core-bot/plugin-sdk/error-runtime";
import type {
  OpenClawConfig,
  SecretInput,
  SecretInputMode,
} from "quiet-core-bot/plugin-sdk/provider-auth";
import { upsertAuthProfileWithLock } from "quiet-core-bot/plugin-sdk/provider-auth";
import { applyAgentDefaultModelPrimary } from "quiet-core-bot/plugin-sdk/provider-onboard";
import type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
import { WizardCancelledError, type WizardPrompter } from "quiet-core-bot/plugin-sdk/setup";
import { fetchWithSsrFGuard } from "quiet-core-bot/plugin-sdk/ssrf-runtime";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
} from "quiet-core-bot/plugin-sdk/string-coerce-runtime";
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DOCKER_HOST_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
} from "./defaults.js";
import { readProviderBaseUrl } from "./provider-base-url.js";
import {
  buildOllamaBaseUrlSsrFPolicy,
  buildOllamaProvider,
  buildOllamaModelDefinition,
  enrichOllamaModelsWithContext,
  fetchOllamaModels,
  resolveOllamaApiBase,
  type OllamaModelWithContext,
} from "./provider-models.js";

export { buildOllamaProvider };

const OLLAMA_SUGGESTED_MODELS_LOCAL = [OLLAMA_DEFAULT_MODEL];
const OLLAMA_CONTEXT_ENRICH_LIMIT = 200;
const OLLAMA_PULL_RESPONSE_TIMEOUT_MS = 30_000;
const OLLAMA_PULL_STREAM_IDLE_TIMEOUT_MS = 300_000;

type OllamaSetupOptions = {
  customBaseUrl?: string;
  customModelId?: string;
};

type OllamaSetupResult = {
  config: OpenClawConfig;
  credential: SecretInput;
  credentialMode?: SecretInputMode;
};

function isTruthyEnvValue(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function resolveOllamaSetupDefaultBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return isTruthyEnvValue(env.QUIET_CORE_DOCKER_SETUP)
    ? OLLAMA_DOCKER_HOST_BASE_URL
    : OLLAMA_DEFAULT_BASE_URL;
}

function buildOllamaUnreachableLines(baseUrl: string): string[] {
  return [
    `Ollama could not be reached at ${baseUrl}.`,
    "Download it at https://ollama.com/download",
    "",
    "Start Ollama and re-run setup.",
  ];
}

function normalizeOllamaModelName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (normalizeLowercaseStringOrEmpty(trimmed).startsWith("ollama/")) {
    const normalized = trimmed.slice("ollama/".length).trim();
    return normalized || undefined;
  }
  return trimmed;
}

function isOllamaCloudModel(modelName: string | undefined): boolean {
  return normalizeOptionalLowercaseString(modelName)?.endsWith(":cloud") === true;
}

function formatOllamaPullStatus(status: string): { text: string; hidePercent: boolean } {
  const trimmed = status.trim();
  const partStatusMatch = trimmed.match(/^([a-z-]+)\s+(?:sha256:)?[a-f0-9]{8,}$/i);
  if (partStatusMatch) {
    return { text: `${partStatusMatch[1]} part`, hidePercent: false };
  }
  if (/^verifying\b.*\bdigest\b/i.test(trimmed)) {
    return { text: "verifying digest", hidePercent: true };
  }
  return { text: trimmed, hidePercent: false };
}

export async function checkOllamaCloudAuth(
  baseUrl: string,
): Promise<{ signedIn: boolean; signinUrl?: string }> {
  try {
    const apiBase = resolveOllamaApiBase(baseUrl);
    const { response, release } = await fetchWithSsrFGuard({
      url: `${apiBase}/api/me`,
      init: {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      },
      policy: buildOllamaBaseUrlSsrFPolicy(apiBase),
      auditContext: "ollama-setup.me",
    });
    try {
      if (response.status === 401) {
        const data = (await response.json()) as { signin_url?: string };
        return { signedIn: false, signinUrl: data.signin_url };
      }
      if (!response.ok) {
        return { signedIn: false };
      }
      return { signedIn: true };
    } finally {
      await release();
    }
  } catch {
    return { signedIn: false };
  }
}

type OllamaPullChunk = {
  status?: string;
  total?: number;
  completed?: number;
  error?: string;
};

type OllamaPullResult = { ok: true } | { ok: false; message: string };

async function readOllamaPullChunkWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  return await new Promise((resolve, reject) => {
    const clear = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    timeoutId = setTimeout(() => {
      timedOut = true;
      clear();
      void reader.cancel().catch(() => undefined);
      reject(
        new Error(
          `Ollama pull stalled: no data received for ${Math.round(OLLAMA_PULL_STREAM_IDLE_TIMEOUT_MS / 1000)}s`,
        ),
      );
    }, OLLAMA_PULL_STREAM_IDLE_TIMEOUT_MS);

    void reader.read().then(
      (result) => {
        clear();
        if (!timedOut) {
          resolve(result);
        }
      },
      (err: unknown) => {
        clear();
        if (!timedOut) {
          reject(toLintErrorObject(err, "Non-Error rejection"));
        }
      },
    );
  });
}

async function pullOllamaModelCore(params: {
  baseUrl: string;
  modelName: string;
  onStatus?: (status: string, percent: number | null) => void;
}): Promise<OllamaPullResult> {
  const baseUrl = resolveOllamaApiBase(params.baseUrl);
  const modelName = normalizeOllamaModelName(params.modelName) ?? params.modelName.trim();
  const responseController = new AbortController();
  const responseTimeout = setTimeout(
    responseController.abort.bind(responseController),
    OLLAMA_PULL_RESPONSE_TIMEOUT_MS,
  );
  try {
    const { response, release } = await fetchWithSsrFGuard({
      url: `${baseUrl}/api/pull`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName }),
      },
      signal: responseController.signal,
      policy: buildOllamaBaseUrlSsrFPolicy(baseUrl),
      auditContext: "ollama-setup.pull",
    });
    clearTimeout(responseTimeout);
    try {
      if (!response.ok) {
        return { ok: false, message: `Failed to download ${modelName} (HTTP ${response.status})` };
      }
      if (!response.body) {
        return { ok: false, message: `Failed to download ${modelName} (no response body)` };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const layers = new Map<string, { total: number; completed: number }>();

      const parseLine = (line: string): OllamaPullResult => {
        const trimmed = line.trim();
        if (!trimmed) {
          return { ok: true };
        }
        try {
          const chunk = JSON.parse(trimmed) as OllamaPullChunk;
          if (chunk.error) {
            return { ok: false, message: `Download failed: ${chunk.error}` };
          }
          if (!chunk.status) {
            return { ok: true };
          }
          if (chunk.total && chunk.completed !== undefined) {
            layers.set(chunk.status, { total: chunk.total, completed: chunk.completed });
            let totalSum = 0;
            let completedSum = 0;
            for (const layer of layers.values()) {
              totalSum += layer.total;
              completedSum += layer.completed;
            }
            params.onStatus?.(
              chunk.status,
              totalSum > 0 ? Math.round((completedSum / totalSum) * 100) : null,
            );
          } else {
            params.onStatus?.(chunk.status, null);
          }
        } catch {
          // Ignore malformed streaming lines from Ollama.
        }
        return { ok: true };
      };

      for (;;) {
        const { done, value } = await readOllamaPullChunkWithIdleTimeout(reader);
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const parsed = parseLine(line);
          if (!parsed.ok) {
            return parsed;
          }
        }
      }

      const trailing = buffer.trim();
      if (trailing) {
        const parsed = parseLine(trailing);
        if (!parsed.ok) {
          return parsed;
        }
      }

      return { ok: true };
    } finally {
      await release();
    }
  } catch (err) {
    const reason = formatErrorMessage(err);
    return { ok: false, message: `Failed to download ${modelName}: ${reason}` };
  } finally {
    clearTimeout(responseTimeout);
  }
}

async function pullOllamaModel(
  baseUrl: string,
  modelName: string,
  prompter: WizardPrompter,
): Promise<boolean> {
  const spinner = prompter.progress(`Downloading ${modelName}...`);
  const result = await pullOllamaModelCore({
    baseUrl,
    modelName,
    onStatus: (status, percent) => {
      const displayStatus = formatOllamaPullStatus(status);
      if (displayStatus.hidePercent) {
        spinner.update(`Downloading ${modelName} - ${displayStatus.text}`);
      } else {
        spinner.update(`Downloading ${modelName} - ${displayStatus.text} - ${percent ?? 0}%`);
      }
    },
  });
  if (!result.ok) {
    spinner.stop(result.message);
    return false;
  }
  spinner.stop(`Downloaded ${modelName}`);
  return true;
}

async function pullOllamaModelNonInteractive(
  baseUrl: string,
  modelName: string,
  runtime: RuntimeEnv,
): Promise<boolean> {
  runtime.log(`Downloading ${modelName}...`);
  const result = await pullOllamaModelCore({ baseUrl, modelName });
  if (!result.ok) {
    runtime.error(result.message);
    return false;
  }
  runtime.log(`Downloaded ${modelName}`);
  return true;
}

function buildOllamaModelsConfig(
  modelNames: string[],
  discoveredModelsByName?: Map<string, OllamaModelWithContext>,
) {
  return modelNames.map((name) => {
    const discovered = discoveredModelsByName?.get(name);
    // Suggested cloud models may be injected before `/api/tags` exposes them,
    // so keep Kimi vision-capable during setup even without discovered metadata.
    const capabilities =
      discovered?.capabilities ?? (name === "kimi-k2.5:cloud" ? ["vision"] : undefined);
    return buildOllamaModelDefinition(name, discovered?.contextWindow, capabilities);
  });
}

function getOllamaLatestDedupeKey(name: string): string {
  const normalized = normalizeLowercaseStringOrEmpty(name);
  return normalized.endsWith(":latest") ? normalized.slice(0, -":latest".length) : normalized;
}

function isExplicitLatestOllamaModel(name: string): boolean {
  return normalizeLowercaseStringOrEmpty(name).endsWith(":latest");
}

function shouldReplaceOllamaModelName(existing: string, candidate: string): boolean {
  return !isExplicitLatestOllamaModel(existing) && isExplicitLatestOllamaModel(candidate);
}

function mergeUniqueModelNames(...groups: string[][]): string[] {
  const indexByKey = new Map<string, number>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const name of group) {
      const key = getOllamaLatestDedupeKey(name);
      const existingIndex = indexByKey.get(key);
      if (existingIndex !== undefined) {
        if (shouldReplaceOllamaModelName(merged[existingIndex], name)) {
          merged[existingIndex] = name;
        }
        continue;
      }
      indexByKey.set(key, merged.length);
      merged.push(name);
    }
  }
  return merged;
}

function findAvailableOllamaModelName(modelName: string, availableModelNames: Iterable<string>) {
  const wantedKey = getOllamaLatestDedupeKey(modelName);
  for (const available of availableModelNames) {
    if (getOllamaLatestDedupeKey(available) === wantedKey) {
      return available;
    }
  }
  return undefined;
}

function applyOllamaProviderConfig(
  cfg: OpenClawConfig,
  baseUrl: string,
  modelNames: string[],
  discoveredModelsByName?: Map<string, OllamaModelWithContext>,
  apiKey: SecretInput = "OLLAMA_API_KEY",
): OpenClawConfig {
  return {
    ...cfg,
    models: {
      ...cfg.models,
      mode: cfg.models?.mode ?? "merge",
      providers: {
        ...cfg.models?.providers,
        ollama: {
          baseUrl,
          api: "ollama",
          apiKey,
          models: buildOllamaModelsConfig(modelNames, discoveredModelsByName),
        },
      },
    },
  };
}

async function storeOllamaCredential(agentDir?: string): Promise<void> {
  await upsertAuthProfileWithLock({
    profileId: "ollama:default",
    credential: { type: "api_key", provider: "ollama", key: "ollama-local" },
    agentDir,
  });
}

async function promptForOllamaBaseUrl(
  prompter: WizardPrompter,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const defaultBaseUrl = resolveOllamaSetupDefaultBaseUrl(env);
  const baseUrlRaw = await prompter.text({
    message: "Ollama base URL",
    initialValue: defaultBaseUrl,
    placeholder: defaultBaseUrl,
    validate: (value) => (value?.trim() ? undefined : "Required"),
  });
  return resolveOllamaApiBase((baseUrlRaw ?? defaultBaseUrl).trim().replace(/\/+$/, ""));
}

async function promptAndConfigureHostBackedOllama(params: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
  env?: NodeJS.ProcessEnv;
}): Promise<OllamaSetupResult> {
  const baseUrl = await promptForOllamaBaseUrl(params.prompter, params.env);
  const { reachable, models } = await fetchOllamaModels(baseUrl);

  if (!reachable) {
    await params.prompter.note(buildOllamaUnreachableLines(baseUrl).join("\n"), "Ollama");
    throw new WizardCancelledError("Ollama not reachable");
  }

  const enrichedModels = await enrichOllamaModelsWithContext(
    baseUrl,
    models.slice(0, OLLAMA_CONTEXT_ENRICH_LIMIT),
  );
  const discoveredModelsByName = new Map(enrichedModels.map((model) => [model.name, model]));
  const discoveredModelNames = models.map((model) => model.name);

  return {
    credential: "ollama-local",
    config: applyOllamaProviderConfig(
      params.cfg,
      baseUrl,
      mergeUniqueModelNames(OLLAMA_SUGGESTED_MODELS_LOCAL, discoveredModelNames),
      discoveredModelsByName,
    ),
  };
}

export async function promptAndConfigureOllama(params: {
  cfg: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
  opts?: Record<string, unknown>;
  prompter: WizardPrompter;
  secretInputMode?: SecretInputMode;
  allowSecretRefPrompt?: boolean;
}): Promise<OllamaSetupResult> {
  return await promptAndConfigureHostBackedOllama({
    cfg: params.cfg,
    prompter: params.prompter,
    env: params.env,
  });
}

export async function configureOllamaNonInteractive(params: {
  nextConfig: OpenClawConfig;
  opts: OllamaSetupOptions;
  runtime: RuntimeEnv;
  agentDir?: string;
}): Promise<OpenClawConfig> {
  const baseUrl = resolveOllamaApiBase(
    (params.opts.customBaseUrl?.trim() || resolveOllamaSetupDefaultBaseUrl()).replace(/\/+$/, ""),
  );
  const { reachable, models } = await fetchOllamaModels(baseUrl);
  const explicitModel = normalizeOllamaModelName(params.opts.customModelId);

  if (!reachable) {
    params.runtime.error(buildOllamaUnreachableLines(baseUrl).slice(0, 2).join("\n"));
    params.runtime.exit(1);
    return params.nextConfig;
  }

  await storeOllamaCredential(params.agentDir);

  const enrichedModels = await enrichOllamaModelsWithContext(
    baseUrl,
    models.slice(0, OLLAMA_CONTEXT_ENRICH_LIMIT),
  );
  const discoveredModelsByName = new Map(enrichedModels.map((model) => [model.name, model]));
  const modelNames = models.map((model) => model.name);
  const orderedModelNames = mergeUniqueModelNames(OLLAMA_SUGGESTED_MODELS_LOCAL, modelNames);

  const requestedDefaultModelId = explicitModel ?? OLLAMA_SUGGESTED_MODELS_LOCAL[0];
  const availableModelNames = new Set(modelNames);
  const availableDefaultModelId = findAvailableOllamaModelName(
    requestedDefaultModelId,
    availableModelNames,
  );
  const requestedCloudModel = isOllamaCloudModel(requestedDefaultModelId);
  let pulledRequestedModel = false;

  if (requestedCloudModel) {
    availableModelNames.add(requestedDefaultModelId);
  } else if (!availableDefaultModelId) {
    pulledRequestedModel = await pullOllamaModelNonInteractive(
      baseUrl,
      requestedDefaultModelId,
      params.runtime,
    );
    if (pulledRequestedModel) {
      availableModelNames.add(requestedDefaultModelId);
    }
  }

  let allModelNames = orderedModelNames;
  let defaultModelId = availableDefaultModelId ?? requestedDefaultModelId;
  if (
    (pulledRequestedModel || requestedCloudModel) &&
    !allModelNames.includes(requestedDefaultModelId)
  ) {
    allModelNames = [...allModelNames, requestedDefaultModelId];
  }

  if (!findAvailableOllamaModelName(defaultModelId, availableModelNames)) {
    if (availableModelNames.size === 0) {
      params.runtime.error(
        [
          `No Ollama models are available at ${baseUrl}.`,
          "Pull a model first, then re-run setup.",
        ].join("\n"),
      );
      params.runtime.exit(1);
      return params.nextConfig;
    }

    defaultModelId =
      allModelNames.find((name) => findAvailableOllamaModelName(name, availableModelNames)) ??
      Array.from(availableModelNames)[0];
    params.runtime.log(
      `Ollama model ${requestedDefaultModelId} was not available; using ${defaultModelId} instead.`,
    );
  }

  const config = applyOllamaProviderConfig(
    params.nextConfig,
    baseUrl,
    allModelNames,
    discoveredModelsByName,
  );
  params.runtime.log(`Default Ollama model: ${defaultModelId}`);
  return applyAgentDefaultModelPrimary(config, `ollama/${defaultModelId}`);
}

export async function ensureOllamaModelPulled(params: {
  config: OpenClawConfig;
  model: string;
  prompter: WizardPrompter;
}): Promise<void> {
  if (!params.model.startsWith("ollama/")) {
    return;
  }
  const baseUrl =
    readProviderBaseUrl(params.config.models?.providers?.ollama) ?? OLLAMA_DEFAULT_BASE_URL;
  const modelName = params.model.slice("ollama/".length);
  if (isOllamaCloudModel(modelName)) {
    return;
  }
  const { models } = await fetchOllamaModels(baseUrl);
  if (
    findAvailableOllamaModelName(
      modelName,
      models.map((model) => model.name),
    )
  ) {
    return;
  }
  if (!(await pullOllamaModel(baseUrl, modelName, params.prompter))) {
    throw new WizardCancelledError("Failed to download selected Ollama model");
  }
}

function toLintErrorObject(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === "string") {
    return new Error(value);
  }
  const error = new Error(fallbackMessage, { cause: value });
  if ((typeof value === "object" && value !== null) || typeof value === "function") {
    Object.assign(error, value);
  }
  return error;
}
