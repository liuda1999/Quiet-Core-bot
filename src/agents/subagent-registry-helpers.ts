/**
 * Subagent registry persistence and recovery helpers.
 *
 * Handles frozen result caps, orphan detection, timing persistence, and announce retry logging.
 */
import fsSync, { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_SUBAGENT_ARCHIVE_AFTER_MINUTES } from "../config/agent-limits.js";
import { getRuntimeConfig } from "../config/config.js";
import {
  appendAssistantMessageToSessionTranscript,
  resolveAgentIdFromSessionKey,
  resolveStorePath,
} from "../config/sessions.js";
import { patchSessionEntry } from "../config/sessions/session-accessor.js";
import { runDetachedFromOwnedSessionTranscriptWrites } from "../config/sessions/transcript-write-context.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { defaultRuntime } from "../runtime.js";
import { writeAnnounceDropDiagnostic } from "./announce-idempotency.js";
import { withSubagentOutcomeTiming } from "./subagent-announce-output.js";
import { getDeliveryAttemptCount, getDeliveryLastError } from "./subagent-delivery-state.js";
import { SUBAGENT_ENDED_REASON_ERROR } from "./subagent-lifecycle-events.js";
import { shouldUpdateRunOutcome } from "./subagent-registry-completion.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";
import {
  getSubagentSessionRuntimeMs,
  getSubagentSessionStartedAt,
  resolveSubagentSessionStatus,
} from "./subagent-session-metrics.js";
import {
  resolveSubagentRunOrphanReason,
  type SubagentRunOrphanReason,
} from "./subagent-session-reconciliation.js";

export {
  getSubagentSessionRuntimeMs,
  getSubagentSessionStartedAt,
  resolveSubagentSessionStatus,
} from "./subagent-session-metrics.js";

export const MIN_ANNOUNCE_RETRY_DELAY_MS = 1_000;
const MAX_ANNOUNCE_RETRY_DELAY_MS = 8_000;
export const MAX_ANNOUNCE_RETRY_COUNT = 3;
export const ANNOUNCE_EXPIRY_MS = 5 * 60_000;
export const ANNOUNCE_COMPLETION_HARD_EXPIRY_MS = 30 * 60_000;

const FROZEN_RESULT_TEXT_MAX_BYTES = 100 * 1024;

/** Caps frozen completion text stored for later announce/recovery delivery. */
export function capFrozenResultText(resultText: string): string {
  const trimmed = resultText.trim();
  if (!trimmed) {
    return "";
  }
  const totalBytes = Buffer.byteLength(trimmed, "utf8");
  if (totalBytes <= FROZEN_RESULT_TEXT_MAX_BYTES) {
    return trimmed;
  }
  const notice = `\n\n[truncated: frozen completion output exceeded ${Math.round(FROZEN_RESULT_TEXT_MAX_BYTES / 1024)}KB (${Math.round(totalBytes / 1024)}KB)]`;
  const maxPayloadBytes = Math.max(
    0,
    FROZEN_RESULT_TEXT_MAX_BYTES - Buffer.byteLength(notice, "utf8"),
  );
  const payload = Buffer.from(trimmed, "utf8").subarray(0, maxPayloadBytes).toString("utf8");
  return `${payload}${notice}`;
}

/** Computes bounded exponential backoff for subagent announce retries. */
export function resolveAnnounceRetryDelayMs(retryCount: number) {
  const boundedRetryCount = Math.max(0, Math.min(retryCount, 10));
  // retryCount is "attempts already made", so retry #1 waits 1s, then 2s, 4s...
  const backoffExponent = Math.max(0, boundedRetryCount - 1);
  const baseDelay = MIN_ANNOUNCE_RETRY_DELAY_MS * 2 ** backoffExponent;
  return Math.min(baseDelay, MAX_ANNOUNCE_RETRY_DELAY_MS);
}

function formatAnnounceGiveUpLogField(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return JSON.stringify(normalized.length > 2_000 ? `${normalized.slice(0, 2_000)}…` : normalized);
}

/** Logs a sanitized final give-up line for failed subagent announce delivery. */
export function logAnnounceGiveUp(entry: SubagentRunRecord, reason: "retry-limit" | "expiry") {
  const retryCount = getDeliveryAttemptCount(entry);
  const endedAgoMs =
    typeof entry.endedAt === "number" ? Math.max(0, Date.now() - entry.endedAt) : undefined;
  const endedAgoLabel = endedAgoMs != null ? `${Math.round(endedAgoMs / 1000)}s` : "n/a";
  const lastDeliveryError = getDeliveryLastError(entry);
  const deliveryError = lastDeliveryError
    ? ` deliveryError=${formatAnnounceGiveUpLogField(lastDeliveryError)}`
    : "";
  defaultRuntime.log(
    `[warn] Subagent announce give up (${reason}) run=${entry.runId} child=${entry.childSessionKey} requester=${entry.requesterSessionKey} retries=${retryCount} endedAgo=${endedAgoLabel}${deliveryError}`,
  );
  // A25: a give-up drops the completion for good, so record it as a diagnostic
  // event instead of leaving the parent session with only a log line.
  writeAnnounceDropDiagnostic({
    runId: entry.runId,
    childSessionKey: entry.childSessionKey,
    requesterSessionKey: entry.requesterSessionKey,
    reason,
    payload: {
      retryCount,
      ...(endedAgoMs != null ? { endedAgoMs } : {}),
      ...(lastDeliveryError ? { deliveryError: lastDeliveryError } : {}),
    },
  });
}

/**
 * Builds the parent-visible fallback notice for a completion whose announce was
 * given up (retry-limit / expiry). The requester session otherwise only gets a
 * `diagnostic_events` row, so the parent run can never observe that the child
 * finished, its terminal status, or that the result was dropped.
 */
export function buildUndeliveredCompletionNoticeText(params: {
  entry: SubagentRunRecord;
  reason: "retry-limit" | "expiry";
}): string {
  const status = params.entry.outcome?.status ?? "unknown";
  const deliveryError = getDeliveryLastError(params.entry);
  return [
    "[subagent completion not delivered]",
    `run: ${params.entry.runId}`,
    `child_session: ${params.entry.childSessionKey}`,
    `status: ${status}`,
    `delivery: failed (${params.reason})`,
    ...(deliveryError ? [`delivery_error: ${deliveryError}`] : []),
  ].join("\n");
}

/**
 * C-M3-1: a swallowed transcript-append failure used to be invisible (`return
 * false` with no reason), which made "the receipt is missing" impossible to
 * diagnose. Every rejected/thrown append now records the concrete cause.
 */
function logRequesterTranscriptAppendFailure(params: {
  label: string;
  requesterSessionKey: string;
  runId?: string;
  deliveryPath?: string;
  reason: string;
}) {
  const fields = [
    ...(params.runId ? [`run=${params.runId}`] : []),
    `requester=${params.requesterSessionKey}`,
    ...(params.deliveryPath ? [`path=${params.deliveryPath}`] : []),
    `reason=${params.reason}`,
  ];
  defaultRuntime.log(`[warn] ${params.label} failed: ${fields.join(" ")}`);
}

function describeTranscriptAppendRejection(result: { code?: string; reason?: string }): string {
  const code = typeof result.code === "string" ? result.code.trim() : "";
  const reason = typeof result.reason === "string" ? result.reason.trim() : "";
  if (code && reason) {
    return `${code}: ${reason}`;
  }
  return code || reason || "unknown";
}

/**
 * Appends the undelivered-completion notice to the requester (parent) session
 * transcript so the drop is visible to the parent run and its user.
 *
 * Best-effort: a missing/unknown requester session returns false instead of
 * throwing, and repeated give-ups dedupe through the run-scoped idempotency key.
 */
export async function appendUndeliveredCompletionNotice(params: {
  entry: SubagentRunRecord;
  reason: "retry-limit" | "expiry";
}): Promise<boolean> {
  const requesterSessionKey = params.entry.requesterSessionKey?.trim();
  if (!requesterSessionKey || !params.entry.childSessionKey?.trim()) {
    return false;
  }
  try {
    const result = await runDetachedFromOwnedSessionTranscriptWrites(() =>
      appendAssistantMessageToSessionTranscript({
        sessionKey: requesterSessionKey,
        text: buildUndeliveredCompletionNoticeText(params),
        idempotencyKey: `subagent-completion-undelivered:${params.entry.runId}`,
        // C9: mark the row as replay-visible. A bare delivery mirror is dropped
        // from the parent run's replay projection, which made this fallback
        // notice invisible to the parent model even though it was written.
        deliveryMirror: { kind: "subagent-completion-undelivered" },
      }),
    );
    if (result.ok !== true) {
      logRequesterTranscriptAppendFailure({
        label: "Subagent completion undelivered notice",
        requesterSessionKey,
        runId: params.entry.runId,
        reason: describeTranscriptAppendRejection(result),
      });
      return false;
    }
    return true;
  } catch (err) {
    logRequesterTranscriptAppendFailure({
      label: "Subagent completion undelivered notice",
      requesterSessionKey,
      runId: params.entry.runId,
      reason: `threw: ${String(err)}`,
    });
    return false;
  }
}

const DELIVERED_RECEIPT_RESULT_MAX_CHARS = 400;

function singleLineReceiptValue(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}…`;
}

/**
 * Builds the parent-visible receipt for a completion handoff that was delivered
 * without leaving a row naming the child run (`deliveryPath=direct`).
 *
 * F2/C-K2-3: a `direct` completion handoff runs the requester's model with the
 * internal completion event as hidden runtime context, so the parent transcript
 * keeps no parent-visible row that names the finished child run. With two
 * concurrent children the parent therefore only showed the announces that
 * happened to land through a steered/wake injection, which made the other
 * child's completion invisible. The receipt is one row per child run.
 */
export function buildDeliveredCompletionReceiptText(params: {
  runId: string;
  childSessionKey: string;
  status: string;
  deliveryPath: string;
  result?: string;
}): string {
  const result = params.result?.trim();
  return [
    "[subagent completion delivered]",
    `run: ${params.runId}`,
    `child_session: ${params.childSessionKey}`,
    `status: ${params.status}`,
    `delivery: delivered (${params.deliveryPath})`,
    ...(result
      ? [`result: ${singleLineReceiptValue(result, DELIVERED_RECEIPT_RESULT_MAX_CHARS)}`]
      : []),
  ].join("\n");
}

/**
 * Appends the delivered-completion receipt to the requester (parent) session
 * transcript so every finished child run has a parent-visible persisted record.
 *
 * Best-effort: a missing/unknown requester session returns false instead of
 * throwing, and the run-scoped idempotency key keeps repeated deliveries of the
 * same child run from producing duplicate rows.
 */
export async function appendDeliveredCompletionReceipt(params: {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  status: string;
  deliveryPath: string;
  result?: string;
}): Promise<boolean> {
  const requesterSessionKey = params.requesterSessionKey.trim();
  const runId = params.runId.trim();
  const childSessionKey = params.childSessionKey.trim();
  if (!requesterSessionKey || !runId || !childSessionKey) {
    return false;
  }
  try {
    const result = await runDetachedFromOwnedSessionTranscriptWrites(() =>
      appendAssistantMessageToSessionTranscript({
        sessionKey: requesterSessionKey,
        text: buildDeliveredCompletionReceiptText({
          runId,
          childSessionKey,
          status: params.status,
          deliveryPath: params.deliveryPath,
          result: params.result,
        }),
        idempotencyKey: `subagent-completion-delivered:${runId}`,
        // Replay-visible so the receipt survives the parent run's replay
        // projection, exactly like the undelivered-completion notice (C9).
        deliveryMirror: { kind: "subagent-completion-delivered" },
      }),
    );
    if (result.ok !== true) {
      logRequesterTranscriptAppendFailure({
        label: "Subagent completion receipt write",
        requesterSessionKey,
        runId,
        deliveryPath: params.deliveryPath,
        reason: describeTranscriptAppendRejection(result),
      });
      return false;
    }
    return true;
  } catch (err) {
    logRequesterTranscriptAppendFailure({
      label: "Subagent completion receipt write",
      requesterSessionKey,
      runId,
      deliveryPath: params.deliveryPath,
      reason: `threw: ${String(err)}`,
    });
    return false;
  }
}

/** Persists child session timing/status derived from the subagent registry row. */
export async function persistSubagentSessionTiming(entry: SubagentRunRecord) {
  const childSessionKey = entry.childSessionKey?.trim();
  if (!childSessionKey) {
    return;
  }

  const cfg = getRuntimeConfig();
  const agentId = resolveAgentIdFromSessionKey(childSessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const startedAt = getSubagentSessionStartedAt(entry);
  const endedAt =
    typeof entry.endedAt === "number" && Number.isFinite(entry.endedAt) ? entry.endedAt : undefined;
  const runtimeMs =
    endedAt !== undefined
      ? getSubagentSessionRuntimeMs(entry, endedAt)
      : getSubagentSessionRuntimeMs(entry);
  const status = resolveSubagentSessionStatus(entry);

  await patchSessionEntry(
    { storePath, sessionKey: childSessionKey },
    (sessionEntry) => {
      const next = { ...sessionEntry };

      if (typeof startedAt === "number" && Number.isFinite(startedAt)) {
        next.startedAt = startedAt;
      } else {
        delete next.startedAt;
      }

      if (typeof endedAt === "number" && Number.isFinite(endedAt)) {
        next.endedAt = endedAt;
      } else {
        delete next.endedAt;
      }

      if (typeof runtimeMs === "number" && Number.isFinite(runtimeMs)) {
        next.runtimeMs = runtimeMs;
      } else {
        delete next.runtimeMs;
      }

      if (status) {
        next.status = status;
      } else {
        delete next.status;
      }
      return next;
    },
    { replaceEntry: true },
  );
}

// Attachment cleanup must stay within the recorded root even if paths were
// symlinks. Compare real paths before removing anything recursively.
function isResolvedChildPath(params: { childPath: string; rootPath: string }) {
  const rootWithSep = params.rootPath.endsWith(path.sep)
    ? params.rootPath
    : `${params.rootPath}${path.sep}`;
  return params.childPath.startsWith(rootWithSep);
}

/** Best-effort async removal for a subagent attachment directory. */
export async function safeRemoveAttachmentsDir(entry: SubagentRunRecord): Promise<void> {
  if (!entry.attachmentsDir || !entry.attachmentsRootDir) {
    return;
  }

  const resolveReal = async (targetPath: string): Promise<string | null> => {
    try {
      return await fs.realpath(targetPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  };

  try {
    const [rootReal, dirReal] = await Promise.all([
      resolveReal(entry.attachmentsRootDir),
      resolveReal(entry.attachmentsDir),
    ]);
    if (!dirReal) {
      return;
    }

    const rootBase = rootReal ?? path.resolve(entry.attachmentsRootDir);
    const dirBase = dirReal;
    if (!isResolvedChildPath({ childPath: dirBase, rootPath: rootBase })) {
      return;
    }
    await fs.rm(dirBase, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function safeRemoveAttachmentsDirSync(entry: SubagentRunRecord): void {
  if (!entry.attachmentsDir || !entry.attachmentsRootDir) {
    return;
  }

  const resolveReal = (targetPath: string): string | null => {
    try {
      return fsSync.realpathSync.native(targetPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  };

  try {
    const rootReal = resolveReal(entry.attachmentsRootDir);
    const dirReal = resolveReal(entry.attachmentsDir);
    if (!dirReal) {
      return;
    }

    const rootBase = rootReal ?? path.resolve(entry.attachmentsRootDir);
    if (!isResolvedChildPath({ childPath: dirReal, rootPath: rootBase })) {
      return;
    }
    fsSync.rmSync(dirReal, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

/** Marks an orphaned registry run finished, cleans attachments, and removes it. */
export function reconcileOrphanedRun(params: {
  runId: string;
  entry: SubagentRunRecord;
  reason: SubagentRunOrphanReason;
  source: "restore" | "resume";
  runs: Map<string, SubagentRunRecord>;
  resumedRuns: Set<string>;
}) {
  const now = Date.now();
  let changed = false;
  if (typeof params.entry.endedAt !== "number") {
    params.entry.endedAt = now;
    changed = true;
  }
  const orphanOutcome = withSubagentOutcomeTiming(
    {
      status: "error",
      error: `orphaned subagent run (${params.reason})`,
    },
    {
      startedAt: params.entry.startedAt,
      endedAt: params.entry.endedAt,
    },
  );
  if (shouldUpdateRunOutcome(params.entry.outcome, orphanOutcome)) {
    params.entry.outcome = orphanOutcome;
    changed = true;
  }
  if (params.entry.endedReason !== SUBAGENT_ENDED_REASON_ERROR) {
    params.entry.endedReason = SUBAGENT_ENDED_REASON_ERROR;
    changed = true;
  }
  if (params.entry.cleanupHandled !== true) {
    params.entry.cleanupHandled = true;
    changed = true;
  }
  if (typeof params.entry.cleanupCompletedAt !== "number") {
    params.entry.cleanupCompletedAt = now;
    changed = true;
  }
  const shouldDeleteAttachments =
    params.entry.cleanup === "delete" || !params.entry.retainAttachmentsOnKeep;
  if (shouldDeleteAttachments) {
    safeRemoveAttachmentsDirSync(params.entry);
  }
  const removed = params.runs.delete(params.runId);
  params.resumedRuns.delete(params.runId);
  if (!removed && !changed) {
    return false;
  }
  defaultRuntime.log(
    `[warn] Subagent orphan run pruned source=${params.source} run=${params.runId} child=${params.entry.childSessionKey} reason=${params.reason}`,
  );
  return true;
}

/** Reconciles orphaned runs found when restoring persisted subagent registry state. */
export function reconcileOrphanedRestoredRuns(params: {
  runs: Map<string, SubagentRunRecord>;
  resumedRuns: Set<string>;
}) {
  const now = Date.now();
  let changed = false;
  for (const [runId, entry] of params.runs.entries()) {
    const orphanReason = resolveSubagentRunOrphanReason({
      entry,
      includeStaleUnended: true,
      now,
    });
    if (!orphanReason) {
      continue;
    }
    if (
      reconcileOrphanedRun({
        runId,
        entry,
        reason: orphanReason,
        source: "restore",
        runs: params.runs,
        resumedRuns: params.resumedRuns,
      })
    ) {
      changed = true;
    }
  }
  return changed;
}

/** Resolves the completed subagent archive delay from config. */
export function resolveArchiveAfterMs(cfg?: QuietCoreConfig) {
  const config = cfg ?? getRuntimeConfig();
  const minutes =
    config.agents?.defaults?.subagents?.archiveAfterMinutes ??
    DEFAULT_SUBAGENT_ARCHIVE_AFTER_MINUTES;
  if (!Number.isFinite(minutes) || minutes < 0) {
    return undefined;
  }
  if (minutes === 0) {
    return undefined;
  }
  return Math.max(1, Math.floor(minutes)) * 60_000;
}
