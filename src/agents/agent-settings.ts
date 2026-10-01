/** Applies agent compaction settings and small-context overflow guards. */
import type { AgentCompactionMode } from "../config/types.agent-defaults.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import type { ContextEngineInfo } from "../context-engine/types.js";
import { MIN_PROMPT_BUDGET_RATIO, MIN_PROMPT_BUDGET_TOKENS } from "./agent-compaction-constants.js";
import { log } from "./embedded-agent-runner/logger.js";
import { resolveProviderEndpoint } from "./provider-attribution.js";

export const DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR = 20_000;

const warnedKeepRecentBudgetKeys = new Set<string>();

/**
 * Report a `keepRecentTokens` that can never leave a compactable region.
 * Deduplicated so a long-lived gateway does not repeat the warning every run.
 */
function warnKeepRecentTokensExceedsPromptBudget(params: {
  promptBudget: number;
  keepRecentTokens: number;
}): void {
  const key = `${params.promptBudget}:${params.keepRecentTokens}`;
  if (warnedKeepRecentBudgetKeys.has(key)) {
    return;
  }
  warnedKeepRecentBudgetKeys.add(key);
  log.warn(
    `[agent-compaction-config] compaction.keepRecentTokens=${params.keepRecentTokens} is at or above the ` +
      `reserve-adjusted prompt budget (${params.promptBudget}). No transcript can exceed the prompt budget, ` +
      `so every overflow compaction reports no_compactable_entries and is skipped. Lower ` +
      `agents.defaults.compaction.keepRecentTokens (or raise the model contextWindow) to below ` +
      `${params.promptBudget} to re-enable compaction.`,
  );
}

type AgentSettingsManagerLike = {
  getCompactionReserveTokens: () => number;
  getCompactionKeepRecentTokens: () => number;
  applyOverrides: (overrides: {
    compaction: {
      reserveTokens?: number;
      keepRecentTokens?: number;
    };
  }) => void;
  setCompactionEnabled?: (enabled: boolean) => void;
};

/** Resolves the configured reserve-token floor for agent compaction. */
function resolveCompactionReserveTokensFloor(cfg?: QuietCoreConfig): number {
  const raw = cfg?.agents?.defaults?.compaction?.reserveTokensFloor;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR;
}

/**
 * Resolve the reserve-token floor actually enforced for a given context window.
 *
 * The configured/default floor is capped to a safe fraction of the context
 * window so small-context models (e.g. Ollama with 16 K tokens) are not starved
 * of prompt budget. Without the cap the default floor of 20 000 can exceed the
 * entire context window, classifying every prompt as an overflow.
 *
 * Shared by the runtime settings path and `doctor`'s prompt-budget advice so the
 * two can never disagree about what the enforced floor is.
 */
export function resolveCompactionReserveTokensFloorForContext(params: {
  cfg?: QuietCoreConfig;
  /** When known, the resolved context window budget for the current model. */
  contextTokenBudget?: number;
}): number {
  let reserveTokensFloor = resolveCompactionReserveTokensFloor(params.cfg);
  const ctxBudget = params.contextTokenBudget;
  if (typeof ctxBudget === "number" && Number.isFinite(ctxBudget) && ctxBudget > 0) {
    const minPromptBudget = Math.min(
      MIN_PROMPT_BUDGET_TOKENS,
      Math.max(1, Math.floor(ctxBudget * MIN_PROMPT_BUDGET_RATIO)),
    );
    const maxReserve = Math.max(0, ctxBudget - minPromptBudget);
    reserveTokensFloor = Math.min(reserveTokensFloor, maxReserve);
  }
  return reserveTokensFloor;
}

function toNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

/** Applies configured compaction reserve/keep-recent settings to an agent settings manager. */
export function applyAgentCompactionSettingsFromConfig(params: {
  settingsManager: AgentSettingsManagerLike;
  cfg?: QuietCoreConfig;
  /** When known, the resolved context window budget for the current model. */
  contextTokenBudget?: number;
}): {
  didOverride: boolean;
  compaction: { reserveTokens: number; keepRecentTokens: number };
} {
  const currentReserveTokens = params.settingsManager.getCompactionReserveTokens();
  const currentKeepRecentTokens = params.settingsManager.getCompactionKeepRecentTokens();
  const compactionCfg = params.cfg?.agents?.defaults?.compaction;

  const configuredReserveTokens = toNonNegativeInt(compactionCfg?.reserveTokens);
  const configuredKeepRecentTokens = toPositiveInt(compactionCfg?.keepRecentTokens);

  // Cap the floor to a safe fraction of the context window so that
  // small-context models (e.g. Ollama with 16 K tokens) are not starved of
  // prompt budget.  Without this cap the default floor of 20 000 can exceed
  // the entire context window, causing every prompt to be classified as an
  // overflow and triggering an infinite compaction loop.
  const ctxBudget = params.contextTokenBudget;
  const reserveTokensFloor = resolveCompactionReserveTokensFloorForContext({
    cfg: params.cfg,
    contextTokenBudget: ctxBudget,
  });

  const targetReserveTokens = Math.max(
    configuredReserveTokens ?? currentReserveTokens,
    reserveTokensFloor,
  );
  const targetKeepRecentTokens = configuredKeepRecentTokens ?? currentKeepRecentTokens;

  // Config validation: `keepRecentTokens` at or above the reserve-adjusted prompt
  // budget can never be satisfied. No transcript can exceed the prompt budget, so
  // every overflow compaction reports `no_compactable_entries` ("Nothing to
  // compact (session too small)") and compaction is permanently disabled — the
  // run then degrades to best-effort over-budget submits. This is not corrected
  // automatically (the value is operator-owned and valid for large windows), it
  // is reported so the misconfiguration is visible instead of silent.
  if (typeof ctxBudget === "number" && Number.isFinite(ctxBudget) && ctxBudget > 0) {
    const promptBudget = Math.max(0, ctxBudget - targetReserveTokens);
    if (promptBudget > 0 && targetKeepRecentTokens >= promptBudget) {
      warnKeepRecentTokensExceedsPromptBudget({
        promptBudget,
        keepRecentTokens: targetKeepRecentTokens,
      });
    }
  }

  const overrides: { reserveTokens?: number; keepRecentTokens?: number } = {};
  if (targetReserveTokens !== currentReserveTokens) {
    overrides.reserveTokens = targetReserveTokens;
  }
  if (targetKeepRecentTokens !== currentKeepRecentTokens) {
    overrides.keepRecentTokens = targetKeepRecentTokens;
  }

  const didOverride = Object.keys(overrides).length > 0;
  if (didOverride) {
    params.settingsManager.applyOverrides({ compaction: overrides });
  }

  return {
    didOverride,
    compaction: {
      reserveTokens: targetReserveTokens,
      keepRecentTokens: targetKeepRecentTokens,
    },
  };
}

/** Resolve the compaction mode after provider-backed safeguard promotion. */
export function resolveEffectiveCompactionMode(cfg?: QuietCoreConfig): AgentCompactionMode {
  const compaction = cfg?.agents?.defaults?.compaction;
  if (compaction?.provider) {
    return "safeguard";
  }
  return compaction?.mode === "safeguard" ? "safeguard" : "default";
}

/**
 * Detect providers whose shared model runtime `isContextOverflow` Case 2 (silent overflow)
 * fires on a successful turn and triggers Quiet Core bot runtime's `_runAutoCompaction` from
 * inside `Session.prompt()`, collapsing `agent.state.messages` before the
 * provider call (quiet-core-bot#75799).
 *
 * True on any of: `zai-native` endpoint class,
 * a `z-ai/` / `openrouter/z-ai/` model-id namespace prefix, or a bare `glm-`
 * model id (no namespace prefix) — the latter covers in-house gateways that
 * expose Zhipu's GLM family directly without a `z-ai/` qualifier. Intentionally
 * narrow: namespaced GLM ids that route through other providers (e.g.
 * `ollama/glm-*`, `opencode-go/glm-*`) are NOT included because their hosts
 * have their own overflow accounting and may not exhibit the z.ai silent-
 * overflow shape. Other providers documented as silently truncating are not
 * added without a reproducible repro.
 */
export function isSilentOverflowProneModel(model: {
  provider?: string | null;
  modelId?: string | null;
  baseUrl?: string | null;
}): boolean {
  if (typeof model.baseUrl === "string" && model.baseUrl.length > 0) {
    if (resolveProviderEndpoint(model.baseUrl).endpointClass === "zai-native") {
      return true;
    }
  }
  if (typeof model.modelId === "string" && model.modelId.length > 0) {
    const normalized = model.modelId.toLowerCase();
    if (
      normalized.startsWith("z-ai/") ||
      normalized.startsWith("openrouter/z-ai/") ||
      normalized.startsWith("glm-")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Disable Quiet Core bot runtime's `_checkCompaction → _runAutoCompaction` (which would otherwise
 * fire from inside `Session.prompt()` and reassign `agent.state.messages`
 * before the provider call) when Quiet Core bot or a plugin owns compaction:
 * `contextEngineInfo.ownsCompaction === true`, effective safeguard compaction,
 * or an active model that is silent-overflow-prone (quiet-core-bot#75799).
 * Default-mode runs against ordinary providers keep Quiet Core bot runtime's auto-compaction as
 * the existing baseline.
 */
function shouldDisableAgentAutoCompaction(params: {
  contextEngineInfo?: ContextEngineInfo;
  compactionMode?: AgentCompactionMode;
  silentOverflowProneProvider?: boolean;
}): boolean {
  return (
    params.contextEngineInfo?.ownsCompaction === true ||
    params.compactionMode === "safeguard" ||
    params.silentOverflowProneProvider === true
  );
}

/**
 * Apply the auto-compaction guard. Callers that reload a `DefaultResourceLoader`
 * MUST call this AGAIN after each `reload()` — `settingsManager.reload()`
 * rehydrates `compaction.enabled` from disk and silently restores Quiet Core bot runtime's
 * default-on behavior, undoing the guard. Mirrors the existing
 * `applyAgentCompactionSettingsFromConfig` re-call pattern at the same sites.
 */
export function applyAgentAutoCompactionGuard(params: {
  settingsManager: AgentSettingsManagerLike;
  contextEngineInfo?: ContextEngineInfo;
  compactionMode?: AgentCompactionMode;
  silentOverflowProneProvider?: boolean;
}): { supported: boolean; disabled: boolean } {
  const disable = shouldDisableAgentAutoCompaction({
    contextEngineInfo: params.contextEngineInfo,
    compactionMode: params.compactionMode,
    silentOverflowProneProvider: params.silentOverflowProneProvider,
  });
  const hasMethod = typeof params.settingsManager.setCompactionEnabled === "function";
  if (!disable || !hasMethod) {
    return { supported: hasMethod, disabled: false };
  }
  params.settingsManager.setCompactionEnabled!(false);
  return { supported: true, disabled: true };
}
