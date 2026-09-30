// Prompt budget advice helpers format doctor guidance for compaction budgets.
//
// Compaction can only free space if the transcript that is *retained* after a
// cut still fits the reserve-adjusted prompt budget. Two inputs decide that:
// the fixed prompt overhead (system prompt, bootstrap/workspace context and
// skills — measured by the caller because they need filesystem access) and
// `compaction.keepRecentTokens`. This module is pure so the arithmetic stays
// unit-testable and mirrors the runtime warning in `agents/agent-settings.ts`.

export type PromptBudgetDoctorAdviceParams = {
  contextWindowTokens: number;
  modelKey: string;
  /** Reserve tokens enforced for this window (configured floor already applied). */
  reserveTokens: number;
  /** Operator-configured `agents.defaults.compaction.keepRecentTokens`, when set. */
  configuredKeepRecentTokens?: number;
  /**
   * Measured fixed prompt overhead in tokens (workspace bootstrap context +
   * skills). The base system prompt and tool schemas are additional and are not
   * included, so the real overhead is at least this large.
   */
  fixedOverheadTokens?: number;
  deep?: boolean;
  scopeLabel?: string;
};

function formatNumber(value: number): string {
  return String(Math.max(0, Math.floor(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function normalizePositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

/**
 * Builds human-readable doctor lines for a compaction budget that cannot free
 * any space, plus the full arithmetic in deep mode.
 */
export function buildPromptBudgetDoctorAdvice(params: PromptBudgetDoctorAdviceParams): string[] {
  const contextWindowTokens = normalizePositiveInt(params.contextWindowTokens);
  if (contextWindowTokens === undefined) {
    return [];
  }

  const reserveTokens = Math.max(0, Math.floor(params.reserveTokens));
  const promptBudget = Math.max(0, contextWindowTokens - reserveTokens);
  const configuredKeepRecentTokens = normalizePositiveInt(params.configuredKeepRecentTokens);
  const fixedOverheadTokens = normalizePositiveInt(params.fixedOverheadTokens);
  const prefix = params.scopeLabel ? `${params.scopeLabel}: ` : "";
  const lines: string[] = [];

  if (params.deep) {
    const overheadPart =
      fixedOverheadTokens === undefined
        ? "fixed prompt overhead unknown"
        : `fixed prompt overhead ~${formatNumber(fixedOverheadTokens)} tokens (workspace context + skills; system prompt and tool schemas excluded)`;
    const keepPart =
      configuredKeepRecentTokens === undefined
        ? "keepRecentTokens unset (runtime default)"
        : `keepRecentTokens ${formatNumber(configuredKeepRecentTokens)}`;
    lines.push(
      `- ${prefix}primary model "${params.modelKey}" context window ${formatNumber(
        contextWindowTokens,
      )} tokens; reserve ${formatNumber(reserveTokens)}; prompt budget ${formatNumber(
        promptBudget,
      )}; ${overheadPart}; ${keepPart}`,
    );
  }

  if (promptBudget <= 0) {
    lines.push(
      `- ${prefix}reserve ${formatNumber(reserveTokens)} meets or exceeds the ${formatNumber(
        contextWindowTokens,
      )} token context window of "${params.modelKey}"; no prompt budget remains for the transcript. ` +
        "Lower agents.defaults.compaction.reserveTokens/reserveTokensFloor or raise the model contextWindow.",
    );
    return lines;
  }

  if (configuredKeepRecentTokens !== undefined && configuredKeepRecentTokens >= promptBudget) {
    lines.push(
      `- ${prefix}compaction.keepRecentTokens is ${formatNumber(
        configuredKeepRecentTokens,
      )} tokens but the reserve-adjusted prompt budget for "${params.modelKey}" is ${formatNumber(
        promptBudget,
      )}. No transcript can ever exceed the prompt budget, so every overflow compaction reports ` +
        `no_compactable_entries and is skipped. Lower agents.defaults.compaction.keepRecentTokens to below ${formatNumber(
          promptBudget,
        )}, or raise the model contextWindow.`,
    );
    return lines;
  }

  if (fixedOverheadTokens !== undefined && fixedOverheadTokens >= promptBudget) {
    lines.push(
      `- ${prefix}fixed prompt overhead is ~${formatNumber(
        fixedOverheadTokens,
      )} tokens (workspace bootstrap context + skills) and already uses the whole ${formatNumber(
        promptBudget,
      )} token prompt budget for "${params.modelKey}". Every turn is an overflow before any ` +
        "transcript is added, so compaction cannot free space. Raise the model contextWindow, trim the " +
        "workspace bootstrap files/skills, or lower the reserve.",
    );
    return lines;
  }

  if (
    fixedOverheadTokens !== undefined &&
    configuredKeepRecentTokens !== undefined &&
    fixedOverheadTokens + configuredKeepRecentTokens > promptBudget
  ) {
    lines.push(
      `- ${prefix}fixed prompt overhead (~${formatNumber(
        fixedOverheadTokens,
      )} tokens) plus compaction.keepRecentTokens (${formatNumber(
        configuredKeepRecentTokens,
      )} tokens) exceed the ${formatNumber(promptBudget)} token prompt budget for "${
        params.modelKey
      }". Compaction would keep more recent tokens than fit, so the overflow returns on the next ` +
        `turn. Lower agents.defaults.compaction.keepRecentTokens to below ${formatNumber(
          Math.max(0, promptBudget - fixedOverheadTokens),
        )}, or raise the model contextWindow.`,
    );
  }

  return lines;
}
