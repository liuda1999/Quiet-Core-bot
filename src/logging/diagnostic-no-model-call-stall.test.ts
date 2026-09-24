// C-K2-1: the "accepted run, never reached a model call" stall must be
// observable even when unrelated session activity keeps the session timestamp
// fresh, and must not fire for a slow prefill or an approval wait.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  onDiagnosticEvent,
  resetDiagnosticEventsForTest,
  type DiagnosticEventPayload,
} from "../infra/diagnostic-events.js";
import {
  formatNoModelCallStallHint,
  RESTART_GATEWAY_SUGGESTED_ACTION,
} from "./diagnostic-no-model-call-hint.js";
import {
  getDiagnosticSessionActivitySnapshot,
  markDiagnosticEmbeddedRunStarted,
  markDiagnosticModelStartedForTest,
  markDiagnosticToolStartedForTest,
  resetDiagnosticRunActivityForTest,
} from "./diagnostic-run-activity.js";
import { classifySessionAttention } from "./diagnostic-session-attention.js";
import { resetDiagnosticSessionStateForTest } from "./diagnostic-session-state.js";
import {
  logMessageQueued,
  logSessionStateChange,
  markDiagnosticSessionProgress,
  resetDiagnosticStateForTest,
  resolveNoModelCallWarnMs,
  startDiagnosticHeartbeat,
} from "./diagnostic.js";

const NO_MODEL_CALL_WARN_MS = 60_000;
const STUCK_SESSION_WARN_MS = 30_000;

function heartbeatConfig(overrides?: { noModelCallWarnMs?: number }) {
  return {
    diagnostics: {
      enabled: true,
      stuckSessionWarnMs: STUCK_SESSION_WARN_MS,
      noModelCallWarnMs: overrides?.noModelCallWarnMs ?? NO_MODEL_CALL_WARN_MS,
    },
  } as never;
}

function collectEvents(): { events: DiagnosticEventPayload[]; unsubscribe: () => void } {
  const events: DiagnosticEventPayload[] = [];
  const unsubscribe = onDiagnosticEvent((event) => {
    events.push(event);
  });
  return { events, unsubscribe };
}

function reasonsFor(events: readonly DiagnosticEventPayload[], type: string): string[] {
  return events
    .filter((event) => (event as { type?: string }).type === type)
    .map((event) => String((event as { reason?: unknown }).reason ?? ""));
}

describe("C-K2-1 no-model-call stall detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDiagnosticStateForTest();
    resetDiagnosticEventsForTest();
    resetDiagnosticRunActivityForTest();
    resetDiagnosticSessionStateForTest();
  });

  afterEach(() => {
    resetDiagnosticEventsForTest();
    resetDiagnosticStateForTest();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reports no_model_call_since_start even while session activity stays fresh", () => {
    const recoverStuckSession = vi.fn();
    const { events, unsubscribe } = collectEvents();
    try {
      startDiagnosticHeartbeat(heartbeatConfig(), { recoverStuckSession });
      logSessionStateChange({ sessionId: "s1", sessionKey: "main", state: "processing" });
      markDiagnosticEmbeddedRunStarted({
        sessionId: "s1",
        sessionKey: "main",
        runId: "run-stalled",
      });
      // Unrelated activity (a queued message / session progress) keeps the
      // session timestamp inside the stuck-session window, which is exactly the
      // shape that used to suppress every stalled warning.
      for (let index = 0; index < 5; index += 1) {
        vi.advanceTimersByTime(20_000);
        markDiagnosticSessionProgress({ sessionId: "s1", sessionKey: "main" });
        logMessageQueued({ sessionId: "s1", sessionKey: "main", source: "test" });
      }
    } finally {
      unsubscribe();
    }

    expect(reasonsFor(events, "session.stalled")).toContain("no_model_call_since_start");
    const stalled = events.find((event) => (event as { type?: string }).type === "session.stalled");
    expect(stalled).toMatchObject({
      reason: "no_model_call_since_start",
      classification: "stalled_agent_run",
      activeWorkKind: "embedded_run",
      sessionKey: "main",
    });
    // Observability only: a silent run must not be auto-recovered.
    expect(recoverStuckSession).not.toHaveBeenCalled();
  });

  it("does not report a stall once a model call has started (slow prefill)", () => {
    const { events, unsubscribe } = collectEvents();
    try {
      startDiagnosticHeartbeat(heartbeatConfig());
      logSessionStateChange({ sessionId: "s1", sessionKey: "main", state: "processing" });
      markDiagnosticEmbeddedRunStarted({
        sessionId: "s1",
        sessionKey: "main",
        runId: "run-prefill",
      });
      markDiagnosticModelStartedForTest({
        runId: "run-prefill",
        sessionId: "s1",
        sessionKey: "main",
        provider: "ollama",
        model: "test-model",
      });
      const activity = getDiagnosticSessionActivitySnapshot({
        sessionId: "s1",
        sessionKey: "main",
      });
      // A started model call is what makes a slow CPU prefill legitimate: the
      // wait for the first token happens inside the call, not before it.
      expect(activity.hasStartedModelCallSinceRunStart).toBe(true);
      expect(
        classifySessionAttention({
          state: "processing",
          queueDepth: 0,
          activity,
          staleMs: STUCK_SESSION_WARN_MS,
          noModelCallThresholdMs: NO_MODEL_CALL_WARN_MS,
        }).reason,
      ).not.toBe("no_model_call_since_start");
      vi.advanceTimersByTime(300_000);
    } finally {
      unsubscribe();
    }

    expect(reasonsFor(events, "session.stalled")).not.toContain("no_model_call_since_start");
  });

  it("does not report a stall while a tool call is active (approval wait)", () => {
    const { events, unsubscribe } = collectEvents();
    try {
      startDiagnosticHeartbeat(heartbeatConfig());
      logSessionStateChange({ sessionId: "s1", sessionKey: "main", state: "processing" });
      markDiagnosticEmbeddedRunStarted({
        sessionId: "s1",
        sessionKey: "main",
        runId: "run-approval",
      });
      markDiagnosticToolStartedForTest({
        runId: "run-approval",
        sessionId: "s1",
        sessionKey: "main",
        toolName: "exec",
        toolCallId: "call-1",
      });
      vi.advanceTimersByTime(300_000);
    } finally {
      unsubscribe();
    }

    expect(reasonsFor(events, "session.stalled")).not.toContain("no_model_call_since_start");
  });

  it("keeps the new branch inactive unless the caller configures a threshold", () => {
    const activity = {
      activeWorkKind: "embedded_run" as const,
      hasActiveEmbeddedRun: true,
      embeddedRunAgeMs: 10 * 60_000,
      hasStartedModelCallSinceRunStart: false,
      lastProgressAgeMs: 10 * 60_000,
      lastProgressReason: "embedded_run:started",
    };
    expect(
      classifySessionAttention({
        state: "processing",
        queueDepth: 0,
        activity,
        staleMs: STUCK_SESSION_WARN_MS,
      }).reason,
    ).not.toBe("no_model_call_since_start");
    // A run that has already issued a model call keeps the older wording even
    // when the run clock is far past the no-model-call threshold.
    expect(
      classifySessionAttention({
        state: "processing",
        queueDepth: 0,
        activity: {
          ...activity,
          hasStartedModelCallSinceRunStart: true,
          lastProgressAgeMs: 1_000,
          lastProgressReason: "model_call:started",
        },
        staleMs: STUCK_SESSION_WARN_MS,
        noModelCallThresholdMs: NO_MODEL_CALL_WARN_MS,
      }).reason,
    ).not.toBe("no_model_call_since_start");
  });

  it("resolves the configured threshold and falls back for out-of-range values", () => {
    expect(resolveNoModelCallWarnMs(undefined)).toBe(10 * 60_000);
    expect(resolveNoModelCallWarnMs(heartbeatConfig({ noModelCallWarnMs: 120_000 }))).toBe(120_000);
    expect(resolveNoModelCallWarnMs(heartbeatConfig({ noModelCallWarnMs: 1_000 }))).toBe(
      10 * 60_000,
    );
  });
});

describe("C-K2-1 no-model-call hint", () => {
  const stalledClassification = {
    eventType: "session.stalled",
    reason: "no_model_call_since_start",
    classification: "stalled_agent_run",
    activeWorkKind: "embedded_run",
    recoveryEligible: false,
  } as const;

  it("names the run, the wait and the suggested action", () => {
    const hint = formatNoModelCallStallHint({
      classification: stalledClassification as never,
      activity: { activeWorkKind: "embedded_run", embeddedRunAgeMs: 700_000, activeRunId: "run-1" },
      sessionKey: "agent:main:main",
    });

    expect(hint?.suggestedAction).toBe(RESTART_GATEWAY_SUGGESTED_ACTION);
    expect(hint?.text).toContain("runId=run-1");
    expect(hint?.text).toContain("700s");
    expect(hint?.text).toContain("agent:main:main");
  });

  it("stays silent while a live exec approval is pending for the session", () => {
    const hint = formatNoModelCallStallHint({
      classification: stalledClassification as never,
      activity: { activeWorkKind: "embedded_run", embeddedRunAgeMs: 700_000, activeRunId: "run-1" },
      sessionKey: "agent:main:main",
      pendingApprovals: [{ approvalId: "approval-1", sessionKey: "agent:main:main" }],
    });

    expect(hint).toBeUndefined();
  });

  it("ignores unrelated classifications", () => {
    expect(
      formatNoModelCallStallHint({
        classification: {
          eventType: "session.stalled",
          reason: "active_work_without_progress",
          classification: "stalled_agent_run",
          activeWorkKind: "embedded_run",
          recoveryEligible: false,
        } as never,
        sessionKey: "agent:main:main",
      }),
    ).toBeUndefined();
  });
});
