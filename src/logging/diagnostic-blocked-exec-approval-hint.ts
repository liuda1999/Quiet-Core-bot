// F1: turn a session that is stalled on a *pending exec approval* into an
// actionable diagnostic line.
//
// Under `tools.exec.mode=auto` an exec command that misses the allowlist blocks
// on a human approval. A blocked `exec` tool call is indistinguishable from a
// long-running command by activity alone, so the hint is only produced when the
// caller can prove a *live* pending exec approval exists for the same session
// (the gateway owns that list). Without that proof the diagnostic stays silent:
// reporting "waiting for approval" for a command that is merely slow would be a
// false positive.
import type { SessionAttentionClassification } from "./diagnostic-session-attention.js";

/** The Quiet Core bot exec tool, whose approval gate can leave a session blocked. */
const EXEC_TOOL_NAME = "exec";

export const APPROVE_PENDING_EXEC_APPROVAL_SUGGESTED_ACTION =
  "approve_pending_exec_approval" as const;

/** Minimal shape of a live pending exec approval, as seen by diagnostics. */
export type PendingExecApprovalHint = {
  approvalId: string;
  sessionKey?: string | null;
  commandPreview?: string | null;
  expiresAtMs?: number | null;
};

export type BlockedExecApprovalHint = {
  text: string;
  suggestedAction: typeof APPROVE_PENDING_EXEC_APPROVAL_SUGGESTED_ACTION;
};

function isLivePendingApproval(entry: PendingExecApprovalHint, nowMs: number): boolean {
  if (typeof entry.expiresAtMs !== "number" || !Number.isFinite(entry.expiresAtMs)) {
    return true;
  }
  return entry.expiresAtMs > nowMs;
}

function livePendingApprovalsForSession(params: {
  pendingApprovals: readonly PendingExecApprovalHint[];
  sessionKey?: string;
  nowMs: number;
}): PendingExecApprovalHint[] {
  const sessionKey = params.sessionKey?.trim();
  return params.pendingApprovals.filter((entry) => {
    if (!isLivePendingApproval(entry, params.nowMs)) {
      return false;
    }
    if (!sessionKey) {
      return false;
    }
    // Approval requests carry the requester session key; only approvals for this
    // exact session can be what the blocked tool call is waiting on.
    return entry.sessionKey?.trim() === sessionKey;
  });
}

/**
 * True when a live pending exec approval exists for exactly this session.
 *
 * Shared with the C-K2-1 no-model-call hint so an approval wait is never
 * reported as a dead run by another stalled-shape detector.
 */
export function hasLivePendingExecApprovalForSession(params: {
  pendingApprovals: readonly PendingExecApprovalHint[];
  sessionKey?: string;
  nowMs?: number;
}): boolean {
  return (
    livePendingApprovalsForSession({
      pendingApprovals: params.pendingApprovals,
      sessionKey: params.sessionKey,
      nowMs: params.nowMs ?? Date.now(),
    }).length > 0
  );
}

/**
 * Actionable diagnostic for a session blocked on a pending exec approval.
 *
 * Returns undefined for every other blocked/stalled shape so unrelated
 * `blocked_tool_call` stalls keep their existing wording.
 */
export function formatBlockedExecApprovalHint(params: {
  classification: SessionAttentionClassification | undefined;
  activeToolName?: string;
  sessionKey?: string;
  pendingApprovals: readonly PendingExecApprovalHint[];
  nowMs?: number;
}): BlockedExecApprovalHint | undefined {
  const classification = params.classification;
  if (
    classification?.eventType !== "session.stalled" ||
    classification.classification !== "blocked_tool_call" ||
    classification.activeWorkKind !== "tool_call"
  ) {
    return undefined;
  }
  if (params.activeToolName?.trim().toLowerCase() !== EXEC_TOOL_NAME) {
    return undefined;
  }
  const nowMs = params.nowMs ?? Date.now();
  const pending = livePendingApprovalsForSession({
    pendingApprovals: params.pendingApprovals,
    sessionKey: params.sessionKey,
    nowMs,
  });
  if (pending.length === 0) {
    return undefined;
  }
  const [first] = pending;
  const shortId = first.approvalId.slice(0, 8);
  const approvalLabel =
    pending.length === 1
      ? `approvalId=${first.approvalId}`
      : `approvalId=${first.approvalId} pendingApprovals=${pending.length}`;
  const command = first.commandPreview?.replace(/\s+/g, " ").trim();
  return {
    text:
      `[diagnostic] session blocked on exec approval (${approvalLabel}, tool=${EXEC_TOOL_NAME}` +
      `${command ? `, command="${command.slice(0, 80)}"` : ""}); ` +
      `approve with: quiet-core-bot approvals approve ${shortId} | list with: quiet-core-bot approvals pending`,
    suggestedAction: APPROVE_PENDING_EXEC_APPROVAL_SUGGESTED_ACTION,
  };
}
