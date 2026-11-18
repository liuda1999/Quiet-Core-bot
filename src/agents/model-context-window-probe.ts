/**
 * Discovers a model's real context window from the provider.
 *
 * Configured `contextWindow` values are frequently written by "add model"
 * flows (or copied from a template) and then drift from what the endpoint
 * actually serves. Because config wins over runtime metadata, a stale 128k
 * entry silently caps compaction and pruning long after the model moved to a
 * larger window.
 *
 * This probe asks the OpenAI-compatible `/models` endpoint (which several
 * vendors extend with `context_length` / `max_context_length`) and caches the
 * answer briefly. It never throws: callers treat `undefined` as "unknown" and
 * fall back to the existing resolution chain.
 *
 * @module agents/model-context-window-probe
 */
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("context-window");

const PROBE_TIMEOUT_MS = 3_000;
const SUCCESS_TTL_MS = 10 * 60_000;
const FAILURE_TTL_MS = 60_000;
/** Anything above this is almost certainly a mis-parsed value, not a real window. */
const MAX_SANE_CONTEXT_WINDOW = 10_000_000;

const WINDOW_FIELDS = [
  "context_length",
  "context_window",
  "contextWindow",
  "max_context_length",
  "max_context_tokens",
  "max_model_len",
] as const;

type CacheEntry = { value: number | undefined; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<number | undefined>>();

/** Drops cached probe results (tests and explicit model refreshes). */
export function clearContextWindowProbeCache(): void {
  cache.clear();
  inFlight.clear();
}

function normalizeWindow(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const tokens = Math.floor(value);
  if (tokens <= 0 || tokens > MAX_SANE_CONTEXT_WINDOW) {
    return undefined;
  }
  return tokens;
}

function readWindowFromEntry(entry: unknown): number | undefined {
  if (entry === null || typeof entry !== "object") {
    return undefined;
  }
  const record = entry as Record<string, unknown>;
  for (const field of WINDOW_FIELDS) {
    const tokens = normalizeWindow(record[field]);
    if (tokens !== undefined) {
      return tokens;
    }
  }
  const topProvider = record.top_provider;
  if (topProvider !== null && typeof topProvider === "object") {
    for (const field of WINDOW_FIELDS) {
      const tokens = normalizeWindow((topProvider as Record<string, unknown>)[field]);
      if (tokens !== undefined) {
        return tokens;
      }
    }
  }
  return undefined;
}

function modelIdsMatch(candidate: string, requested: string): boolean {
  if (candidate === requested) {
    return true;
  }
  return candidate.endsWith(`/${requested}`) || requested.endsWith(`/${candidate}`);
}

/**
 * Extracts the requested model's window from a `/models` payload.
 * Tolerates `{ data: [...] }`, `{ models: [...] }`, and bare arrays; falls back
 * to the only entry when the provider serves a single model.
 */
export function parseContextWindowFromModelsPayload(
  payload: unknown,
  modelId: string,
): number | undefined {
  const list = (() => {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload !== null && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      for (const key of ["data", "models", "items"] as const) {
        if (Array.isArray(record[key])) {
          return record[key] as unknown[];
        }
      }
    }
    return undefined;
  })();
  if (list === undefined || list.length === 0) {
    return undefined;
  }

  const matched = list.find((entry) => {
    if (entry === null || typeof entry !== "object") {
      return false;
    }
    const id = (entry as Record<string, unknown>).id ?? (entry as Record<string, unknown>).name;
    return typeof id === "string" && modelIdsMatch(id, modelId);
  });
  if (matched !== undefined) {
    return readWindowFromEntry(matched);
  }
  return list.length === 1 ? readWindowFromEntry(list[0]) : undefined;
}

function buildCandidateUrls(baseUrl: string): string[] {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (trimmed.length === 0) {
    return [];
  }
  const hasVersion = /\/v\d+(?:beta\d*)?$/u.test(trimmed);
  return hasVersion ? [`${trimmed}/models`] : [`${trimmed}/v1/models`, `${trimmed}/models`];
}

async function fetchModelsPayload(url: string, apiKey: string | undefined): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/** Resolves the real context window for one provider/model pair. */
export async function probeModelContextWindow(params: {
  provider: string;
  modelId: string;
  baseUrl?: string | null;
  apiKey?: string;
}): Promise<number | undefined> {
  const baseUrl = params.baseUrl?.trim();
  if (!baseUrl) {
    return undefined;
  }
  const key = `${baseUrl}|${params.modelId}`;
  const cached = cache.get(key);
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const pending = inFlight.get(key);
  if (pending !== undefined) {
    return await pending;
  }

  const run = (async (): Promise<number | undefined> => {
    for (const url of buildCandidateUrls(baseUrl)) {
      try {
        const payload = await fetchModelsPayload(url, params.apiKey);
        const tokens = parseContextWindowFromModelsPayload(payload, params.modelId);
        if (tokens !== undefined) {
          cache.set(key, { value: tokens, expiresAt: Date.now() + SUCCESS_TTL_MS });
          return tokens;
        }
      } catch {
        // Try the next candidate; a 404 usually means the other URL shape.
      }
    }
    cache.set(key, { value: undefined, expiresAt: Date.now() + FAILURE_TTL_MS });
    return undefined;
  })();

  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Applies a probed window to a resolved model without mutating the shared
 * object. Returns the original model when the probe finds nothing.
 */
export function withProbedContextWindow<T extends { contextWindow?: number }>(
  model: T,
  probed: number | undefined,
): T & { contextWindowProbed?: true } {
  if (probed === undefined || probed === model.contextWindow) {
    return model;
  }
  log.debug?.(
    `[context-window] provider reports ${probed} tokens (configured ${model.contextWindow ?? "unset"})`,
  );
  return { ...model, contextWindow: probed, contextWindowProbed: true };
}
