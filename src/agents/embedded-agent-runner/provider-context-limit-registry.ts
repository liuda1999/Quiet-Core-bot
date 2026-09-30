/**
 * Learned provider context limits.
 *
 * A model's declared `contextWindow` can be larger than the limit the provider
 * actually enforces — for example after the session switches to a smaller-window
 * deployment while the config (or catalog) still declares the old, larger window.
 * Every budget and compaction threshold derived from the declaration is then too
 * generous, so the prompt overflows before compaction is ever considered.
 *
 * The provider states its real limit in the overflow error. Remembering it per
 * provider/model lets the next turn resolve the context budget from the real
 * limit, so compaction is evaluated against the window that actually applies.
 */
type LearnedContextLimit = {
  statedLimitTokens: number;
  declaredContextWindow: number;
};

const learnedLimits = new Map<string, LearnedContextLimit>();

function limitKey(provider: string, modelId: string): string {
  return `${provider.trim().toLowerCase()}/${modelId.trim().toLowerCase()}`;
}

/**
 * Record the provider-stated context limit when it is smaller than the declared
 * window. An under-declaration only wastes space, so it is ignored.
 */
export function recordProviderContextLimit(params: {
  provider: string;
  modelId: string;
  statedLimitTokens: number;
  declaredContextWindow: number;
}): boolean {
  const stated = Math.floor(params.statedLimitTokens);
  const declared = Math.floor(params.declaredContextWindow);
  if (!Number.isFinite(stated) || !Number.isFinite(declared) || stated <= 0 || declared <= 0) {
    return false;
  }
  if (stated >= declared) {
    return false;
  }
  learnedLimits.set(limitKey(params.provider, params.modelId), {
    statedLimitTokens: stated,
    declaredContextWindow: declared,
  });
  return true;
}

/**
 * Clamp a declared context budget to the learned provider limit. Returns the
 * declared value unchanged when nothing has been learned, or when the learned
 * limit is not smaller than the declaration.
 */
export function clampContextBudgetWithLearnedLimit(params: {
  provider: string;
  modelId: string;
  declaredContextWindowTokens: number;
}): { tokens: number; learnedLimitTokens?: number } {
  const declared = Math.floor(params.declaredContextWindowTokens);
  if (!Number.isFinite(declared) || declared <= 0) {
    return { tokens: declared };
  }
  const learned = learnedLimits.get(limitKey(params.provider, params.modelId));
  if (!learned || learned.statedLimitTokens >= declared) {
    return { tokens: declared };
  }
  return {
    tokens: Math.max(1, learned.statedLimitTokens),
    learnedLimitTokens: learned.statedLimitTokens,
  };
}

/** Clears learned limits. Test-only. */
export function resetLearnedProviderContextLimitsForTest(): void {
  learnedLimits.clear();
}
