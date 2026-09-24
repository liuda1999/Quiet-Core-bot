// C-K2-1: turn a session whose accepted run never reached a model call into an
// actionable diagnostic line.
//
// The stalled-session detector runs on a progress clock that unrelated session
// activity can refresh, so a run that is accepted, owns the session write lock,
// and then never starts a single model call could stay silent for the whole
// stall. This hint names that shape explicitly and tells the operator what to
// do, but only when the shape is provable:
//   - the classification must be `no_model_call_since_start`, and
//   - no live exec approval may be pending for the same session, because a run
//     waiting on a human approval is not a dead run and must not be restarted.
import {
  hasLivePendingExecApprovalForSession,
  type PendingExecApprovalHint,
} from "./diagnostic-blocked-exec-approval-hint.js";
import type { DiagnosticSessionActivitySnapshot } from "./diagnostic-run-activity.js";
import type { SessionAttentionClassification } from "./diagnostic-session-attention.js";

export const RESTART_GATEWAY_SUGGESTED_ACTION = "restart_gateway" as const;

export type NoModelCallStallHint = {
  text: string;
  suggestedAction: typeof RESTART_GATEWAY_SUGGESTED_ACTION;
};

/**
 * Actionable diagnostic for an accepted run that never reached a model call.
 *
 * Returns undefined for every other stalled/blocked shape so unrelated stalls
 * keep their existing wording.
 */
export function formatNoModelCallStallHint(params: {
  classification: SessionAttentionClassification | undefined;
  activity?: DiagnosticSessionActivitySnapshot;
  sessionKey?: string;
  pendingApprovals?: readonly PendingExecApprovalHint[];
  nowMs?: number;
}): NoModelCallStallHint | undefined {
  const classification = params.classification;
  if (
    classification?.eventType !== "session.stalled" ||
    classification.reason !== "no_model_call_since_start"
  ) {
    return undefined;
  }
  if (
    (params.pendingApprovals?.length ?? 0) > 0 &&
    hasLivePendingExecApprovalForSession({
      pendingApprovals: params.pendingApprovals ?? [],
      sessionKey: params.sessionKey,
      nowMs: params.nowMs,
    })
  ) {
    return undefined;
  }
  const waitedSeconds = Math.round((params.activity?.embeddedRunAgeMs ?? 0) / 1000);
  const runId = params.activity?.activeRunId ?? "unknown";
  return {
    text:
      `[diagnostic] run accepted but no model call started after ${waitedSeconds}s ` +
      `(sessionKey=${params.sessionKey ?? "unknown"} runId=${runId}); ` +
      "check provider/proxy reachability before retrying, then restart the gateway if the run stays silent",
    suggestedAction: RESTART_GATEWAY_SUGGESTED_ACTION,
  };
}
