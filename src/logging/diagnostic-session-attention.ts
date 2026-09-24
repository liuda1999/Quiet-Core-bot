// Diagnostic session attention helpers summarize active work for session diagnostics.
import type { DiagnosticSessionActiveWorkKind } from "../infra/diagnostic-events.js";
import type { DiagnosticSessionActivitySnapshot } from "./diagnostic-run-activity.js";

export type SessionAttentionClassification =
  | {
      eventType: "session.long_running";
      reason: string;
      classification: "long_running";
      activeWorkKind?: DiagnosticSessionActiveWorkKind;
      recoveryEligible: false;
    }
  | {
      eventType: "session.stalled";
      reason: string;
      classification: "blocked_tool_call" | "stalled_agent_run";
      activeWorkKind?: DiagnosticSessionActiveWorkKind;
      recoveryEligible: false;
    }
  | {
      eventType: "session.stuck";
      reason: string;
      classification: "stale_session_state";
      activeWorkKind?: undefined;
      recoveryEligible: true;
    };

export function classifySessionAttention(params: {
  state?: "idle" | "processing" | "waiting";
  queueDepth: number;
  activity: DiagnosticSessionActivitySnapshot;
  staleMs: number;
  stuckSessionAbortMs?: number;
  /**
   * C-K2-1: age threshold for an accepted run that has not reached a single
   * model call yet. Undefined disables the `no_model_call_since_start` branch.
   */
  noModelCallThresholdMs?: number;
}): SessionAttentionClassification {
  if (params.activity.activeWorkKind) {
    const lastProgressAgeMs = params.activity.lastProgressAgeMs ?? 0;

    // Idle session with queued work and stale orphaned activity (no active
    // embedded owner) should be classified as recoverable stuck state, not as
    // stalled active work. This prevents orphaned model_call or tool_call
    // activity from blocking the queue indefinitely.
    if (
      params.state === "idle" &&
      params.queueDepth > 0 &&
      params.activity.hasActiveEmbeddedRun !== true &&
      lastProgressAgeMs > params.staleMs
    ) {
      return {
        eventType: "session.stuck",
        reason: "queued_work_without_active_run",
        classification: "stale_session_state",
        recoveryEligible: true,
      };
    }
    if (
      params.activity.activeWorkKind === "tool_call" &&
      (params.activity.activeToolAgeMs ?? 0) > params.staleMs &&
      lastProgressAgeMs > params.staleMs
    ) {
      return {
        eventType: "session.stalled",
        reason: "blocked_tool_call",
        classification: "blocked_tool_call",
        activeWorkKind: params.activity.activeWorkKind,
        recoveryEligible: false,
      };
    }
    if (
      params.queueDepth > 0 &&
      params.activity.activeWorkKind === "embedded_run" &&
      isTerminalDiagnosticProgressReason(params.activity.lastProgressReason)
    ) {
      return {
        eventType: "session.stalled",
        reason: "queued_behind_terminal_active_work",
        classification: "stalled_agent_run",
        activeWorkKind: params.activity.activeWorkKind,
        recoveryEligible: false,
      };
    }
    if (
      params.activity.activeWorkKind === "model_call" &&
      params.activity.hasActiveEmbeddedRun === true &&
      lastProgressAgeMs > params.staleMs
    ) {
      if (
        typeof params.stuckSessionAbortMs === "number" &&
        lastProgressAgeMs >= params.stuckSessionAbortMs
      ) {
        return {
          eventType: "session.stalled",
          reason: "active_work_without_progress",
          classification: "stalled_agent_run",
          activeWorkKind: params.activity.activeWorkKind,
          recoveryEligible: false,
        };
      }
      return {
        eventType: "session.long_running",
        reason: "active_model_call_without_progress",
        classification: "long_running",
        activeWorkKind: params.activity.activeWorkKind,
        recoveryEligible: false,
      };
    }
    if (
      params.activity.activeWorkKind === "embedded_run" &&
      params.activity.hasStartedModelCallSinceRunStart !== true &&
      typeof params.noModelCallThresholdMs === "number" &&
      (params.activity.embeddedRunAgeMs ?? 0) > params.noModelCallThresholdMs
    ) {
      // C-K2-1: the run owner is registered and the session is not waiting on a
      // tool call, but no model call has ever been observed for it. A slow
      // provider is excluded because its prefill happens inside a started model
      // call, and an approval wait is excluded because it carries a tool_call
      // marker (handled above).
      return {
        eventType: "session.stalled",
        reason: "no_model_call_since_start",
        classification: "stalled_agent_run",
        activeWorkKind: params.activity.activeWorkKind,
        recoveryEligible: false,
      };
    }
    if (lastProgressAgeMs > params.staleMs) {
      return {
        eventType: "session.stalled",
        reason: "active_work_without_progress",
        classification: "stalled_agent_run",
        activeWorkKind: params.activity.activeWorkKind,
        recoveryEligible: false,
      };
    }
    return {
      eventType: "session.long_running",
      reason: params.queueDepth > 0 ? "queued_behind_active_work" : "active_work",
      classification: "long_running",
      activeWorkKind: params.activity.activeWorkKind,
      recoveryEligible: false,
    };
  }

  return {
    eventType: "session.stuck",
    reason: params.queueDepth > 0 ? "queued_work_without_active_run" : "stale_session_state",
    classification: "stale_session_state",
    recoveryEligible: true,
  };
}

export function isTerminalDiagnosticProgressReason(reason: string | undefined): boolean {
  if (!reason) {
    return false;
  }
  return (
    reason === "run:completed" ||
    reason === "embedded_run:ended" ||
    reason.includes("response.completed") ||
    reason.includes("rawResponseItem/completed") ||
    reason.includes("raw_response_item.completed") ||
    reason.includes("output_item.done")
  );
}
