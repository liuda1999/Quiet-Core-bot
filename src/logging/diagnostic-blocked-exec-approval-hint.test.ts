// F1: guards for the actionable "blocked on a pending exec approval" diagnostic.
import { describe, expect, it } from "vitest";
import {
  APPROVE_PENDING_EXEC_APPROVAL_SUGGESTED_ACTION,
  formatBlockedExecApprovalHint,
  type PendingExecApprovalHint,
} from "./diagnostic-blocked-exec-approval-hint.js";
import type { SessionAttentionClassification } from "./diagnostic-session-attention.js";

const blockedExecClassification: SessionAttentionClassification = {
  eventType: "session.stalled",
  reason: "blocked_tool_call",
  classification: "blocked_tool_call",
  activeWorkKind: "tool_call",
  recoveryEligible: false,
};

function pendingApproval(
  overrides: Partial<PendingExecApprovalHint> = {},
): PendingExecApprovalHint {
  return {
    approvalId: "54d8b109-1111-2222-3333-444444444444",
    sessionKey: "agent:main:main",
    commandPreview: "curl https://example.test",
    expiresAtMs: 1_000_000,
    ...overrides,
  };
}

describe("formatBlockedExecApprovalHint", () => {
  it("renders the approval id and the CLI command that resolves it", () => {
    const hint = formatBlockedExecApprovalHint({
      classification: blockedExecClassification,
      activeToolName: "exec",
      sessionKey: "agent:main:main",
      pendingApprovals: [pendingApproval()],
      nowMs: 999_000,
    });
    expect(hint?.suggestedAction).toBe(APPROVE_PENDING_EXEC_APPROVAL_SUGGESTED_ACTION);
    expect(hint?.text).toContain("tool=exec");
    expect(hint?.text).toContain("approve with: quiet-core-bot approvals approve 54d8b109");
    expect(hint?.text).toContain("list with: quiet-core-bot approvals pending");
  });

  it("stays silent for expired approvals so a resolved request is never re-offered", () => {
    expect(
      formatBlockedExecApprovalHint({
        classification: blockedExecClassification,
        activeToolName: "exec",
        sessionKey: "agent:main:main",
        pendingApprovals: [pendingApproval({ expiresAtMs: 1_000 })],
        nowMs: 999_000,
      }),
    ).toBeUndefined();
  });

  it("only matches approvals belonging to the blocked session", () => {
    expect(
      formatBlockedExecApprovalHint({
        classification: blockedExecClassification,
        activeToolName: "exec",
        sessionKey: "agent:main:main",
        pendingApprovals: [pendingApproval({ sessionKey: "agent:other:main" })],
        nowMs: 999_000,
      }),
    ).toBeUndefined();
  });

  it("does not claim an exec approval block for a non-exec tool call", () => {
    expect(
      formatBlockedExecApprovalHint({
        classification: blockedExecClassification,
        activeToolName: "web_search",
        sessionKey: "agent:main:main",
        pendingApprovals: [pendingApproval()],
        nowMs: 999_000,
      }),
    ).toBeUndefined();
  });

  it("does not claim an approval block for stalled non-tool-call work", () => {
    expect(
      formatBlockedExecApprovalHint({
        classification: {
          eventType: "session.stalled",
          reason: "active_work_without_progress",
          classification: "stalled_agent_run",
          activeWorkKind: "model_call",
          recoveryEligible: false,
        },
        activeToolName: "exec",
        sessionKey: "agent:main:main",
        pendingApprovals: [pendingApproval()],
        nowMs: 999_000,
      }),
    ).toBeUndefined();
  });

  it("reports how many approvals are waiting when more than one is pending", () => {
    const hint = formatBlockedExecApprovalHint({
      classification: blockedExecClassification,
      activeToolName: "exec",
      sessionKey: "agent:main:main",
      pendingApprovals: [
        pendingApproval(),
        pendingApproval({ approvalId: "aaaaaaaa-2222-3333-4444-555555555555" }),
      ],
      nowMs: 999_000,
    });
    expect(hint?.text).toContain("pendingApprovals=2");
  });
});
