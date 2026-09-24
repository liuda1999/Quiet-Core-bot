/**
 * Provider-owned error-pattern dispatch plus legacy fallback patterns.
 *
 * Most provider-specific failover classification now lives on provider-plugin
 * hooks. This module keeps only fallback patterns for providers that do not
 * yet ship a dedicated provider plugin hook surface.
 */

import { resolveNodeRequireFromMeta } from "../../logging/node-require.js";
import type { FailoverReason } from "./types.js";

type ProviderErrorPattern = {
  /** Regex to match against the raw error message. */
  test: RegExp;
  /** The failover reason this pattern maps to. */
  reason: FailoverReason;
};

/**
 * Provider-specific context overflow patterns not covered by the generic
 * `isContextOverflowError()` in errors.ts. Called from `isContextOverflowError()`
 * to catch provider-specific wording that the generic regex misses.
 */
const PROVIDER_CONTEXT_OVERFLOW_PATTERNS: readonly RegExp[] = [
  // AWS Bedrock validation / stream errors use provider-specific wording.
  /\binput token count exceeds the maximum number of input tokens\b/i,
  /\binput is too long for this model\b/i,

  // Google Vertex / Gemini REST surfaces this wording.
  /\binput exceeds the maximum number of tokens\b/i,

  // Ollama may append a provider prefix and extra token wording.
  /\bollama error:\s*context length exceeded(?:,\s*too many tokens)?\b/i,

  // Cohere does not currently ship a bundled provider hook.
  /\btotal tokens?.*exceeds? (?:the )?(?:model(?:'s)? )?(?:max|maximum|limit)/i,

  // llama.cpp HTTP server (often used directly or behind an OpenAI-compatible
  // shim) returns "request (N tokens) exceeds the available context size
  // (M tokens), try increasing it" when the prompt overshoots a slot's
  // ctx-size. Wording is from the upstream slot manager and is stable.
  // Example: "400 request (66202 tokens) exceeds the available context size (65536 tokens), try increasing it"
  /\b(?:request|prompt) \(\d[\d,]*\s*tokens?\) exceeds (?:the )?available context size\b/i,

  // Generic "input too long" pattern that isn't covered by existing checks
  /\binput (?:is )?too long for (?:the )?model\b/i,
];

/**
 * Provider-specific patterns that map to specific failover reasons.
 * These handle cases where the generic classifiers in failover-matches.ts
 * produce wrong results for specific providers.
 */
const PROVIDER_SPECIFIC_PATTERNS: readonly ProviderErrorPattern[] = [
  {
    test: /\bthrottlingexception\b/i,
    reason: "rate_limit",
  },
  {
    test: /\bconcurrency limit(?: has been)? reached\b/i,
    reason: "rate_limit",
  },
  {
    test: /\bworkers_ai\b.*\bquota limit exceeded\b/i,
    reason: "rate_limit",
  },
  {
    test: /\bmodelnotreadyexception\b/i,
    reason: "overloaded",
  },
  // Groq does not currently ship a bundled provider hook.
  {
    test: /model(?:_is)?_deactivated|model has been deactivated/i,
    reason: "model_not_found",
  },
];

type ProviderRuntimeHooks = {
  classifyProviderFailoverReasonWithPlugin: (params: {
    provider?: string;
    context: ProviderSpecificErrorContext;
  }) => FailoverReason | null;
  matchesProviderContextOverflowWithPlugin: (params: {
    context: { errorMessage: string };
  }) => boolean;
};

const requireProviderRuntime = resolveNodeRequireFromMeta(import.meta.url);
let cachedProviderRuntimeHooks: ProviderRuntimeHooks | null | undefined;

const PROVIDER_CONTEXT_OVERFLOW_SIGNAL_RE =
  /\b(?:context|window|prompt|token|tokens|input|request|model)\b/i;
const PROVIDER_CONTEXT_OVERFLOW_ACTION_RE =
  /\b(?:too\s+(?:large|long|many)|exceed(?:s|ed|ing)?|overflow|limit|maximum|max)\b/i;

function resolveProviderRuntimeHooks(): ProviderRuntimeHooks | null {
  if (cachedProviderRuntimeHooks !== undefined) {
    return cachedProviderRuntimeHooks;
  }
  if (!requireProviderRuntime) {
    cachedProviderRuntimeHooks = null;
    return cachedProviderRuntimeHooks;
  }
  try {
    const loaded = requireProviderRuntime(
      "../../plugins/provider-runtime.js",
    ) as unknown as ProviderRuntimeHooks;
    cachedProviderRuntimeHooks = {
      classifyProviderFailoverReasonWithPlugin: ({ provider, context }) =>
        loaded.classifyProviderFailoverReasonWithPlugin({ provider, context }) ?? null,
      matchesProviderContextOverflowWithPlugin: loaded.matchesProviderContextOverflowWithPlugin,
    };
  } catch {
    cachedProviderRuntimeHooks = null;
  }
  return cachedProviderRuntimeHooks ?? null;
}

function looksLikeProviderContextOverflowCandidate(errorMessage: string): boolean {
  return (
    PROVIDER_CONTEXT_OVERFLOW_SIGNAL_RE.test(errorMessage) &&
    PROVIDER_CONTEXT_OVERFLOW_ACTION_RE.test(errorMessage)
  );
}

type ProviderSpecificErrorContext = {
  provider?: string;
  modelId?: string;
  errorMessage: string;
  status?: number;
  code?: string;
  errorType?: string;
};

function normalizeProviderSpecificErrorContext(
  input: string | ProviderSpecificErrorContext,
): ProviderSpecificErrorContext {
  return typeof input === "string" ? { errorMessage: input } : input;
}

type ProviderSpecificErrorOptions = {
  includePluginHooks?: boolean;
};

/**
 * Check if an error message matches any provider-specific context overflow pattern.
 * Called from `isContextOverflowError()` to catch provider-specific wording.
 */
export function matchesProviderContextOverflow(errorMessage: string): boolean {
  if (!looksLikeProviderContextOverflowCandidate(errorMessage)) {
    return false;
  }
  const runtimeHooks = resolveProviderRuntimeHooks();
  return (
    runtimeHooks?.matchesProviderContextOverflowWithPlugin({
      context: { errorMessage },
    }) === true || PROVIDER_CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorMessage))
  );
}

export function classifyProviderPluginError(
  input: string | ProviderSpecificErrorContext,
): FailoverReason | null {
  const context = normalizeProviderSpecificErrorContext(input);
  const runtimeHooks = resolveProviderRuntimeHooks();
  return (
    runtimeHooks?.classifyProviderFailoverReasonWithPlugin({
      provider: context.provider,
      context,
    }) ?? null
  );
}

/**
 * Try to classify an error using provider-specific patterns.
 * Returns null if no provider-specific pattern matches (fall through to generic classification).
 */
export function classifyProviderSpecificError(
  input: string | ProviderSpecificErrorContext,
  opts?: ProviderSpecificErrorOptions,
): FailoverReason | null {
  const context = normalizeProviderSpecificErrorContext(input);
  if (opts?.includePluginHooks !== false) {
    const pluginReason = classifyProviderPluginError(context);
    if (pluginReason) {
      return pluginReason;
    }
  }
  for (const pattern of PROVIDER_SPECIFIC_PATTERNS) {
    if (pattern.test.test(context.errorMessage)) {
      return pattern.reason;
    }
  }
  return null;
}

/**
 * Context limit a provider states in its own overflow error, per provider
 * wording (OpenAI/OpenRouter/LiteLLM "maximum context length is N tokens",
 * Anthropic "prompt is too long: N tokens > M maximum", llama.cpp
 * "available context size (N tokens)", Mistral "maximum context length", ...).
 */
const PROVIDER_STATED_CONTEXT_LIMIT_PATTERNS: readonly RegExp[] = [
  /maximum context length (?:is|of)\s*([\d,]+)\s*tokens?/i,
  /maximum context length[:=]\s*([\d,]+)/i,
  /maximum prompt length is\s*([\d,]+)/i,
  /available context size\s*\(([\d,]+)\s*tokens?\)/i,
  /maximum number of tokens allowed\s*\(([\d,]+)\)/i,
  /context length\s*\(([\d,]+)\s*tokens?\)/i,
  /exceeds the limit of\s*([\d,]+)/i,
  /token limit:\s*([\d,]+)/i,
  />\s*([\d,]+)\s*maximum/i,
];

export type ProviderContextLimitMismatch = {
  /** Limit the provider itself reported for the rejected request. */
  statedLimitTokens: number;
  /** Limit the gateway declared for the model (`models.providers.<id>.models[].contextWindow`). */
  declaredContextWindow: number;
  /**
   * `under-declared` = the provider accepts more than we declared (usable window
   * wasted, compaction runs far too early); `over-declared` = we declared more
   * than the provider accepts (the request dies with a hard 400 / silent
   * truncation risk).
   */
  direction: "under-declared" | "over-declared";
  /** How far off the declaration is (>= 1). */
  ratio: number;
};

/**
 * Extract the provider's own context limit from an overflow error and compare it
 * with the declared `contextWindow`. A mismatch means every budget/compaction
 * decision made from the declaration disagrees with the provider, which used to
 * be completely silent on the `openai-completions` family (R8-A4).
 */
export function resolveProviderContextLimitMismatch(params: {
  errorMessage: string;
  declaredContextWindow?: number;
}): ProviderContextLimitMismatch | undefined {
  const declared = params.declaredContextWindow;
  if (typeof declared !== "number" || !Number.isFinite(declared) || declared <= 0) {
    return undefined;
  }
  let stated: number | undefined;
  for (const pattern of PROVIDER_STATED_CONTEXT_LIMIT_PATTERNS) {
    const match = pattern.exec(params.errorMessage);
    const raw = match?.[1];
    if (!raw) {
      continue;
    }
    const parsed = Number.parseInt(raw.replaceAll(",", ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      stated = parsed;
      break;
    }
  }
  if (stated === undefined || stated === declared) {
    return undefined;
  }
  return {
    statedLimitTokens: stated,
    declaredContextWindow: declared,
    direction: stated > declared ? "under-declared" : "over-declared",
    ratio: Math.round((Math.max(stated, declared) / Math.min(stated, declared)) * 100) / 100,
  };
}
