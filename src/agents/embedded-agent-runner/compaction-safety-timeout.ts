/**
 * Wraps compaction calls with a safety timeout and abort cleanup.
 */
import {
  clampTimerTimeoutMs,
  finiteSecondsToTimerSafeMilliseconds,
} from "@quiet-core/normalization-core/number-coercion";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import type { CompactResult, ContextEngine } from "../../context-engine/types.js";
import { withTimeout } from "../../node-host/with-timeout.js";
import type { StreamFn } from "../runtime/index.js";

const EMBEDDED_COMPACTION_TIMEOUT_MS = 180_000;

/**
 * Grace added to the compaction safety budget before the summarization request
 * itself is allowed to time out. The grace keeps the configured budget as the
 * authority for slow summaries: the safety timer fires first and reports
 * `Compaction timed out` (`[compaction-diag] outcome=failed reason=timeout`)
 * instead of an opaque provider transport error whose limit is unrelated to
 * `agents.defaults.compaction.timeoutSeconds`.
 */
const COMPACTION_PROVIDER_TIMEOUT_GRACE_MS = 10_000;

function createAbortError(signal: AbortSignal): Error {
  const reason = "reason" in signal ? signal.reason : undefined;
  if (reason instanceof Error) {
    return reason;
  }
  const err = reason ? new Error("aborted", { cause: reason }) : new Error("aborted");
  err.name = "AbortError";
  return err;
}

function composeAbortSignals(...signals: Array<AbortSignal | undefined>): {
  signal?: AbortSignal;
  cleanup: () => void;
} {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (activeSignals.length <= 1) {
    return { signal: activeSignals[0], cleanup: () => {} };
  }

  const controller = new AbortController();
  const removers: Array<() => void> = [];

  const abortFrom = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort("reason" in signal ? signal.reason : undefined);
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    const onAbort = () => abortFrom(signal);
    signal.addEventListener("abort", onAbort, { once: true });
    removers.push(() => signal.removeEventListener("abort", onAbort));
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const remove of removers) {
        remove();
      }
    },
  };
}

export function resolveCompactionTimeoutMs(cfg?: QuietCoreConfig): number {
  return (
    finiteSecondsToTimerSafeMilliseconds(cfg?.agents?.defaults?.compaction?.timeoutSeconds, {
      floorSeconds: true,
    }) ?? EMBEDDED_COMPACTION_TIMEOUT_MS
  );
}

/**
 * True when the operator set an explicit `agents.defaults.compaction.timeoutSeconds`
 * budget. Callers use this to decide whether runner-owned compaction (the only
 * path bounded by {@link resolveCompactionTimeoutMs}) must still run when the
 * attempt already auto-compacted: silently skipping it would make the configured
 * budget unobservable.
 */
export function isCompactionTimeoutConfigured(cfg?: QuietCoreConfig): boolean {
  return (
    finiteSecondsToTimerSafeMilliseconds(cfg?.agents?.defaults?.compaction?.timeoutSeconds, {
      floorSeconds: true,
    }) !== undefined
  );
}

/**
 * Provider request timeout (ms) for the summarization call, coupled to
 * {@link resolveCompactionTimeoutMs}: the transport is given the compaction
 * budget plus {@link COMPACTION_PROVIDER_TIMEOUT_GRACE_MS} so a slow summary is
 * attributed to the compaction budget (`Compaction timed out`) rather than to an
 * unrelated provider transport limit.
 */
export function resolveCompactionProviderTimeoutMs(cfg?: QuietCoreConfig): number {
  const budgetMs = resolveCompactionTimeoutMs(cfg);
  return clampTimerTimeoutMs(budgetMs + COMPACTION_PROVIDER_TIMEOUT_GRACE_MS) ?? budgetMs;
}

/**
 * Applies {@link resolveCompactionProviderTimeoutMs} to a compaction session's
 * stream function. An explicit caller-provided `timeoutMs` always wins so
 * provider-specific tuning is not clobbered.
 */
export function wrapCompactionStreamWithProviderTimeout(
  streamFn: StreamFn,
  timeoutMs: number,
): StreamFn {
  return (model, context, options) => {
    const existing = (options as { timeoutMs?: unknown } | undefined)?.timeoutMs;
    const nextOptions =
      typeof existing === "number" && Number.isFinite(existing) && existing > 0
        ? options
        : ({ ...options, timeoutMs } as typeof options);
    return streamFn(model, context, nextOptions);
  };
}

export async function compactWithSafetyTimeout<T>(
  compact: (abortSignal?: AbortSignal) => Promise<T>,
  timeoutMs: number = EMBEDDED_COMPACTION_TIMEOUT_MS,
  opts?: {
    abortSignal?: AbortSignal;
    onCancel?: () => void;
  },
): Promise<T> {
  let canceled = false;
  const cancel = () => {
    if (canceled) {
      return;
    }
    canceled = true;
    try {
      opts?.onCancel?.();
    } catch {
      // Best-effort cancellation hook. Keep the timeout/abort path intact even
      // if the underlying compaction cancel operation throws.
    }
  };

  return await withTimeout(
    async (timeoutSignal) => {
      let timeoutListener: (() => void) | undefined;
      let externalAbortListener: (() => void) | undefined;
      let externalAbortPromise: Promise<never> | undefined;
      const abortSignal = opts?.abortSignal;
      const composedAbortSignal = composeAbortSignals(timeoutSignal, abortSignal);

      if (timeoutSignal) {
        timeoutListener = () => {
          cancel();
        };
        timeoutSignal.addEventListener("abort", timeoutListener, { once: true });
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          cancel();
          throw createAbortError(abortSignal);
        }
        externalAbortPromise = new Promise((_, reject) => {
          externalAbortListener = () => {
            cancel();
            reject(createAbortError(abortSignal));
          };
          abortSignal.addEventListener("abort", externalAbortListener, { once: true });
        });
      }

      try {
        const compactPromise = compact(composedAbortSignal.signal);
        if (externalAbortPromise) {
          return await Promise.race([compactPromise, externalAbortPromise]);
        }
        return await compactPromise;
      } finally {
        composedAbortSignal.cleanup();
        if (timeoutListener) {
          timeoutSignal?.removeEventListener("abort", timeoutListener);
        }
        if (externalAbortListener) {
          abortSignal?.removeEventListener("abort", externalAbortListener);
        }
      }
    },
    timeoutMs,
    "Compaction",
  );
}

/** Parameters for a single {@link ContextEngine.compact} invocation. */
type ContextEngineCompactParams = Parameters<ContextEngine["compact"]>[0];

/**
 * Invoke a plugin-owned {@link ContextEngine.compact} bounded by the same
 * finite safety timeout that protects native runtime compaction.
 *
 * Plugin context engines that advertise `ownsCompaction` previously had their
 * `compact()` awaited with no timeout, no watchdog, and no abort signal — a
 * slow or hung plugin compaction would hang the agent turn indefinitely. This
 * wrapper closes that gap:
 *  - the call is bounded by `timeoutMs` (host-resolved, default
 *    {@link EMBEDDED_COMPACTION_TIMEOUT_MS}); on timeout it rejects with a
 *    "Compaction timed out" error so the caller's existing failure handling
 *    runs instead of hanging;
 *  - the timeout signal and caller `abortSignal` are both raced against the
 *    call (so a non-cooperating engine is still bounded) and threaded into the
 *    `compact()` params (so cooperating engines can cancel their own in-flight
 *    work).
 *
 * Callers keep their existing try/catch — a timeout or abort surfaces as a
 * thrown error, never a silent hang.
 */
export function compactContextEngineWithSafetyTimeout(
  contextEngine: Pick<ContextEngine, "compact">,
  params: ContextEngineCompactParams,
  timeoutMs: number = EMBEDDED_COMPACTION_TIMEOUT_MS,
  abortSignal?: AbortSignal,
): Promise<CompactResult> {
  return compactWithSafetyTimeout(
    (compactAbortSignal) =>
      contextEngine.compact(
        compactAbortSignal ? { ...params, abortSignal: compactAbortSignal } : params,
      ),
    timeoutMs,
    abortSignal ? { abortSignal } : undefined,
  );
}
