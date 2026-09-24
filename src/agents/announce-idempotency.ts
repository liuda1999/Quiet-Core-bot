/**
 * Stable announce identifiers for child-run completion messages.
 * Versioned keys let future formats coexist with persisted v1 delivery records.
 *
 * Also owns the local announce delivery ledger (idempotency) and the drop
 * diagnostic identity used when an announce can no longer be delivered.
 */
import { readDiagnosticEvent, writeDiagnosticEvent } from "../state/diagnostic-events-store.js";

type AnnounceIdFromChildRunParams = {
  childSessionKey: string;
  childRunId: string;
};

/** Build the persisted announce id for a child session/run pair. */
export function buildAnnounceIdFromChildRun(params: AnnounceIdFromChildRunParams): string {
  return `v1:${params.childSessionKey}:${params.childRunId}`;
}

/** Build the idempotency key used by announce delivery storage. */
export function buildAnnounceIdempotencyKey(announceId: string): string {
  return `announce:${announceId}`;
}

/**
 * Delivery stages a completion handoff can be recorded under.
 *
 * There is no user turn key on the announce path, so the delivery stage plays
 * that role: the completion handoff and the descendant wake are separate
 * deliveries of the same child run.
 */
export type AnnounceDeliveryStage = "completion-announce" | "wake-continuation";

/** Builds the local delivery ledger key: child run id plus delivery stage. */
export function buildAnnounceDeliveryKey(params: {
  childRunId: string;
  stage: AnnounceDeliveryStage;
}): string {
  return `${params.childRunId.trim()}:${params.stage}`;
}

/**
 * Diagnostic scope for announces that were dropped instead of delivered.
 *
 * A25: dropped announces used to be log-only, so a parent session could end up
 * with no event and no record explaining the missing completion.
 *
 * One child run produces at most ONE row. A single run can be dropped twice for
 * different reasons (delivery-time `requester_abandoned`, then the retry budget
 * exhausting as `retry-limit`), so the row merges both: `reason` is the
 * prevailing (highest-priority) cause, `reasons` keeps the full history and
 * `dropCount` counts the drops. Priority order is
 * `requester_abandoned` > `retry-limit` > `expiry` > unknown: an abandoned
 * requester is the terminal cause and the retry/expiry reason is only the
 * downstream budget that ran out, so the row must not be overwritten by it.
 */
export const SUBAGENT_ANNOUNCE_DROP_SCOPE = "subagent_announce_drop";

const ANNOUNCE_DROP_REASON_PRIORITY: readonly string[] = [
  "requester_abandoned",
  "retry-limit",
  "expiry",
];

function announceDropReasonRank(reason: string): number {
  const index = ANNOUNCE_DROP_REASON_PRIORITY.indexOf(reason);
  return index >= 0 ? index : ANNOUNCE_DROP_REASON_PRIORITY.length;
}

/** Orders observed drop reasons by priority, keeping first-seen order within one priority. */
function orderAnnounceDropReasons(reasons: readonly string[]): string[] {
  return reasons
    .map((reason, index) => ({ index, reason }))
    .sort(
      (a, b) =>
        announceDropReasonRank(a.reason) - announceDropReasonRank(b.reason) || a.index - b.index,
    )
    .map((entry) => entry.reason);
}

/** Merges previously recorded drop reasons with a newly observed one. */
export function mergeAnnounceDropReasons(previous: unknown, next: string): string[] {
  const seen: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.includes(trimmed)) {
      return;
    }
    seen.push(trimmed);
  };
  if (Array.isArray(previous)) {
    for (const value of previous) {
      push(value);
    }
  } else {
    push(previous);
  }
  push(next);
  return orderAnnounceDropReasons(seen);
}

/**
 * Builds the diagnostic event key for one dropped announce.
 *
 * The key is run-scoped (not run+reason) so a run that gets dropped again for a
 * second reason refreshes the same row instead of adding a row that contradicts
 * the first one.
 */
export function buildAnnounceDropEventKey(params: { runId: string }): string {
  return params.runId.trim();
}

/** Records a dropped announce as a diagnostic event (best-effort, never throws). */
export function writeAnnounceDropDiagnostic(params: {
  runId: string;
  reason: string;
  childSessionKey?: string;
  requesterSessionKey?: string;
  payload?: Record<string, unknown>;
}): boolean {
  const runId = params.runId.trim();
  const reason = params.reason.trim();
  if (!runId || !reason) {
    return false;
  }
  const eventKey = buildAnnounceDropEventKey({ runId });
  const previous = readDiagnosticEvent({ scope: SUBAGENT_ANNOUNCE_DROP_SCOPE, eventKey });
  const previousPayload =
    previous?.payload && typeof previous.payload === "object"
      ? (previous.payload as Record<string, unknown>)
      : {};
  const reasons = mergeAnnounceDropReasons(
    previousPayload.reasons ?? previousPayload.reason,
    reason,
  );
  const dropCount =
    typeof previousPayload.dropCount === "number" ? previousPayload.dropCount + 1 : 1;
  const childSessionKey = params.childSessionKey?.trim() || previousPayload.childSessionKey;
  const requesterSessionKey =
    params.requesterSessionKey?.trim() || previousPayload.requesterSessionKey;
  return writeDiagnosticEvent({
    scope: SUBAGENT_ANNOUNCE_DROP_SCOPE,
    eventKey,
    payload: {
      ...previousPayload,
      ...params.payload,
      runId,
      // Prevailing reason first; `latestReason` keeps the most recent observation.
      reason: reasons[0] ?? reason,
      reasons,
      latestReason: reason,
      dropCount,
      ...(childSessionKey ? { childSessionKey } : {}),
      ...(requesterSessionKey ? { requesterSessionKey } : {}),
    },
  });
}

// The delivery ledger is process-local. Cross-process duplicate agent calls are
// already rejected by the gateway dedupe on the stable announce idempotency key;
// this ledger additionally covers the steer path (which carries no such key) and
// repeated retry-loop attempts inside one gateway process.
const ANNOUNCE_DELIVERY_TTL_MS = 30 * 60 * 1000;
const MAX_TRACKED_ANNOUNCE_DELIVERIES = 512;

const announceDeliveryClaimedAtMs = new Map<string, number>();

function pruneAnnounceDeliveryLedger(nowMs: number): void {
  for (const [key, claimedAtMs] of announceDeliveryClaimedAtMs) {
    if (nowMs - claimedAtMs >= ANNOUNCE_DELIVERY_TTL_MS) {
      announceDeliveryClaimedAtMs.delete(key);
    }
  }
  const overflow = announceDeliveryClaimedAtMs.size - MAX_TRACKED_ANNOUNCE_DELIVERIES;
  if (overflow <= 0) {
    return;
  }
  for (const key of [...announceDeliveryClaimedAtMs.keys()].slice(0, overflow)) {
    announceDeliveryClaimedAtMs.delete(key);
  }
}

/**
 * Claims one announce delivery. Returns false when the same run + stage was
 * already claimed, so the caller must not deliver again.
 */
export function claimAnnounceDelivery(key: string, nowMs: number = Date.now()): boolean {
  const normalized = key.trim();
  if (!normalized) {
    return true;
  }
  pruneAnnounceDeliveryLedger(nowMs);
  if (announceDeliveryClaimedAtMs.has(normalized)) {
    return false;
  }
  announceDeliveryClaimedAtMs.set(normalized, nowMs);
  return true;
}

/** Releases a claim so a failed delivery attempt can be retried. */
export function releaseAnnounceDeliveryClaim(key: string): void {
  announceDeliveryClaimedAtMs.delete(key.trim());
}

/** Clears the in-process delivery ledger (tests only). */
export function resetAnnounceDeliveryLedgerForTest(): void {
  announceDeliveryClaimedAtMs.clear();
}
