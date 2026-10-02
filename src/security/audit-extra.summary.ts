// Summarizes extra security audit findings for user-facing output.
import { isPrivateOrLoopbackIpAddress } from "@quiet-core/net-policy/ip";
import {
  resolveConfiguredToolPolicies,
  resolveProviderToolPolicy,
} from "../agents/agent-tools.policy.js";
import { parseModelRef } from "../agents/model-selection-normalize.js";
import { resolveSandboxConfigForAgent } from "../agents/sandbox/config.js";
import type { SandboxToolPolicy } from "../agents/sandbox/types.js";
import { isToolAllowedByPolicies } from "../agents/tool-policy-match.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import type { AgentToolsConfig } from "../config/types.tools.js";
import { hasConfiguredInternalHooks } from "../hooks/configured.js";
import { hasConfiguredWebSearchCredential } from "../plugins/web-search-credential-presence.js";
import { inferParamBFromIdOrName } from "../shared/model-param-b.js";
import { collectAuditModelRefs } from "./audit-model-refs.js";

/** Lightweight audit finding shape used by summary-only audit helpers. */
export type SecurityAuditFinding = {
  checkId: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  remediation?: string;
};

// Broad heuristic threshold for flagging candidate small models. At this size the
// parameter count alone is not enough to justify a blocking finding for a
// user-selected local default, so severity is decided per entry below.
const SMALL_MODEL_PARAM_B_MAX = 300;
// Genuinely tiny models stay blocking even when they are the user's explicitly
// configured local default, because they cannot be trusted with web/browser tools.
const TINY_MODEL_PARAM_B_MAX = 10;
// Well-known local runtimes that may not appear in models.providers.
const LOCAL_PROVIDER_IDS = new Set([
  "ollama",
  "lmstudio",
  "llama-cpp",
  "llamacpp",
  "llama.cpp",
  "vllm",
  "localai",
  "text-generation-webui",
]);

function summarizeGroupPolicy(cfg: QuietCoreConfig): {
  open: number;
  allowlist: number;
  other: number;
} {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  if (!channels || typeof channels !== "object") {
    return { open: 0, allowlist: 0, other: 0 };
  }
  let open = 0;
  let allowlist = 0;
  let other = 0;
  for (const value of Object.values(channels)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const section = value as Record<string, unknown>;
    const policy = section.groupPolicy;
    if (policy === "open") {
      open += 1;
    } else if (policy === "allowlist") {
      allowlist += 1;
    } else {
      other += 1;
    }
  }
  return { open, allowlist, other };
}

function extractAgentIdFromSource(source: string): string | null {
  const match = source.match(/^agents\.list\.([^.]*)\./);
  return match?.[1] ?? null;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "")
    .replace(/^\[(.*)\]$/, "$1");
}

function isLocalProviderBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }
  let hostname: string;
  try {
    hostname = new URL(baseUrl.trim()).hostname;
  } catch {
    return false;
  }
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || isPrivateOrLoopbackIpAddress(normalized);
}

/** Returns whether a model provider resolves to a self-hosted/local endpoint. */
function isLocalProvider(cfg: QuietCoreConfig, provider: string | undefined): boolean {
  if (typeof provider !== "string") {
    return false;
  }
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (LOCAL_PROVIDER_IDS.has(normalized)) {
    return true;
  }
  const entry = cfg.models?.providers?.[provider] ?? cfg.models?.providers?.[normalized];
  if (!entry) {
    return false;
  }
  return Boolean(entry.localService) || isLocalProviderBaseUrl(entry.baseUrl);
}

function resolveToolPolicies(params: {
  cfg: QuietCoreConfig;
  agentTools?: AgentToolsConfig;
  sandboxMode?: "off" | "non-main" | "all";
  agentId?: string | null;
  modelProvider?: string;
  modelId?: string;
}): SandboxToolPolicy[] {
  const globalProviderPolicy = resolveProviderToolPolicy({
    byProvider: params.cfg.tools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });
  const agentProviderPolicy = resolveProviderToolPolicy({
    byProvider: params.agentTools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });
  return resolveConfiguredToolPolicies({
    cfg: params.cfg,
    agentTools: params.agentTools,
    sandboxMode: params.sandboxMode,
    agentId: params.agentId,
    extraPolicies: [globalProviderPolicy, agentProviderPolicy],
  });
}

function hasWebSearchKey(cfg: QuietCoreConfig, env: NodeJS.ProcessEnv): boolean {
  return hasConfiguredWebSearchCredential({
    config: cfg,
    env,
    origin: "bundled",
  });
}

function isWebSearchEnabled(cfg: QuietCoreConfig, env: NodeJS.ProcessEnv): boolean {
  const enabled = cfg.tools?.web?.search?.enabled;
  if (enabled === false) {
    return false;
  }
  if (enabled === true) {
    return true;
  }
  return hasWebSearchKey(cfg, env);
}

function isWebFetchEnabled(cfg: QuietCoreConfig): boolean {
  const enabled = cfg.tools?.web?.fetch?.enabled;
  if (enabled === false) {
    return false;
  }
  return true;
}

function isBrowserEnabled(cfg: QuietCoreConfig): boolean {
  return cfg.browser?.enabled !== false;
}

/** Produce a concise inventory of major security-relevant surfaces. */
export function collectAttackSurfaceSummaryFindings(cfg: QuietCoreConfig): SecurityAuditFinding[] {
  const group = summarizeGroupPolicy(cfg);
  const elevated = cfg.tools?.elevated?.enabled !== false;
  const webhooksEnabled = cfg.hooks?.enabled === true;
  const internalHooksEnabled = hasConfiguredInternalHooks(cfg);
  const browserEnabled = cfg.browser?.enabled ?? true;

  const detail =
    `groups: open=${group.open}, allowlist=${group.allowlist}` +
    `\n` +
    `tools.elevated: ${elevated ? "enabled" : "disabled"}` +
    `\n` +
    `hooks.webhooks: ${webhooksEnabled ? "enabled" : "disabled"}` +
    `\n` +
    `hooks.internal: ${internalHooksEnabled ? "enabled" : "disabled"}` +
    `\n` +
    `browser control: ${browserEnabled ? "enabled" : "disabled"}` +
    `\n` +
    "trust model: personal assistant (one trusted operator boundary), not hostile multi-tenant on one shared gateway";

  return [
    {
      checkId: "summary.attack_surface",
      severity: "info",
      title: "Attack surface summary",
      detail,
    },
  ];
}

/** Flag small-parameter models when they retain web/browser tool exposure. */
export function collectSmallModelRiskFindings(params: {
  cfg: QuietCoreConfig;
  env: NodeJS.ProcessEnv;
}): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];
  const models = collectAuditModelRefs(params.cfg).filter(
    (entry) => !entry.source.includes("imageModel"),
  );
  if (models.length === 0) {
    return findings;
  }

  const smallModels: Array<{ id: string; source: string; paramB: number }> = [];
  for (const entry of models) {
    const paramB = inferParamBFromIdOrName(entry.id);
    if (paramB && paramB <= SMALL_MODEL_PARAM_B_MAX) {
      smallModels.push({ id: entry.id, source: entry.source, paramB });
    }
  }

  if (smallModels.length === 0) {
    return findings;
  }

  let hasBlockingUnsafe = false;
  const modelLines: string[] = [];
  const exposureSet = new Set<string>();
  for (const entry of smallModels) {
    const agentId = extractAgentIdFromSource(entry.source);
    // Evaluate each model in its agent context because sandbox/tool policy can
    // differ per agent and provider override.
    const modelRef = parseModelRef(entry.id, "openai", {
      allowPluginNormalization: false,
    });
    const sandboxMode = resolveSandboxConfigForAgent(params.cfg, agentId ?? undefined).mode;
    const agentTools =
      agentId && params.cfg.agents?.list
        ? params.cfg.agents.list.find((agent) => agent?.id === agentId)?.tools
        : undefined;
    const policies = resolveToolPolicies({
      cfg: params.cfg,
      agentTools,
      sandboxMode,
      agentId,
      modelProvider: modelRef?.provider,
      modelId: modelRef?.model,
    });
    const exposed: string[] = [];
    if (
      isWebSearchEnabled(params.cfg, params.env) &&
      isToolAllowedByPolicies("web_search", policies)
    ) {
      exposed.push("web_search");
    }
    if (isWebFetchEnabled(params.cfg) && isToolAllowedByPolicies("web_fetch", policies)) {
      exposed.push("web_fetch");
    }
    if (isBrowserEnabled(params.cfg) && isToolAllowedByPolicies("browser", policies)) {
      exposed.push("browser");
    }
    for (const tool of exposed) {
      exposureSet.add(tool);
    }
    const sandboxLabel = sandboxMode === "all" ? "sandbox=all" : `sandbox=${sandboxMode}`;
    const exposureLabel = exposed.length > 0 ? ` web=[${exposed.join(", ")}]` : " web=[off]";
    const safe = exposed.length === 0;
    // A user-selected default primary on a local provider is not blocking from
    // the broad <=SMALL_MODEL_PARAM_B_MAX heuristic alone; only genuinely tiny
    // models keep the critical signal.
    const userSelectedLocalDefault =
      entry.source === "agents.defaults.model.primary" &&
      isLocalProvider(params.cfg, modelRef?.provider);
    const downgraded = !safe && userSelectedLocalDefault && entry.paramB > TINY_MODEL_PARAM_B_MAX;
    if (!safe && !downgraded) {
      hasBlockingUnsafe = true;
    }
    const statusLabel = safe ? "ok" : downgraded ? "info(local default)" : "unsafe";
    modelLines.push(
      `- ${entry.id} (paramB=${entry.paramB}B parsed from this model id) @ ${entry.source} (${statusLabel}; ${sandboxLabel};${exposureLabel})`,
    );
  }

  const exposureList = Array.from(exposureSet);
  const exposureDetail =
    exposureList.length > 0
      ? `Uncontrolled input tools allowed: ${exposureList.join(", ")}.`
      : "No web/browser tools detected for these models.";

  findings.push({
    checkId: "models.small_params",
    severity: hasBlockingUnsafe ? "critical" : "info",
    title: "Small models require sandboxing and web tools disabled",
    detail:
      `Small model candidates (paramB <= ${SMALL_MODEL_PARAM_B_MAX}, inferred from the model id) detected:\n` +
      modelLines.join("\n") +
      `\n` +
      `Severity rule: a model that is the explicitly configured default primary ` +
      `(agents.defaults.model.primary) on a local provider is downgraded to info unless ` +
      `it is <= ${TINY_MODEL_PARAM_B_MAX}B.\n` +
      exposureDetail +
      `\n` +
      "Small models are not recommended for untrusted inputs.",
    remediation:
      'If you must use small models, disable web_search/web_fetch/browser globally or for each small model with tools.byProvider["provider/model"].deny=["group:web","browser"]; use agents.defaults.sandbox.mode="all" for defense in depth.',
  });

  return findings;
}
