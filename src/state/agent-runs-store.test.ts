// Agent run ledger tests cover persistence, status transitions, and restart sweeps.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listAgentRuns,
  maybeSweepStaleAgentRuns,
  recordAgentRunEnded,
  recordAgentRunStarted,
  sweepStaleAgentRuns,
  testing,
} from "./agent-runs-store.js";
import {
  closeOpenClawStateDatabaseForTest,
  openOpenClawStateDatabase,
} from "./quiet-core-bot-state-db.js";

const originalStateDir = process.env["QUIET_CORE_STATE_DIR"];
let stateDir: string;

function insertAgentRun(row: {
  runId: string;
  sessionKey?: string;
  sessionId?: string;
  status: string;
  startedAt?: number;
  ownerPid?: number | null;
  ownerInstanceId?: string | null;
}): void {
  const database = openOpenClawStateDatabase();
  database.db
    .prepare(
      `INSERT INTO agent_runs (
         run_id, session_key, session_id, status, started_at, ended_at, ended_reason,
         owner_pid, owner_instance_id, updated_at
       ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    )
    .run(
      row.runId,
      row.sessionKey ?? null,
      row.sessionId ?? null,
      row.status,
      row.startedAt ?? Date.now(),
      row.ownerPid ?? null,
      row.ownerInstanceId ?? null,
      Date.now(),
    );
}

function readAgentRun(runId: string): Record<string, unknown> | undefined {
  return openOpenClawStateDatabase()
    .db.prepare("SELECT * FROM agent_runs WHERE run_id = ?")
    .get(runId) as Record<string, unknown> | undefined;
}

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot-agent-runs-"));
  process.env["QUIET_CORE_STATE_DIR"] = stateDir;
  testing.resetSweepStateForTest();
  testing.resetPendingTerminalWritesForTest();
});

afterEach(() => {
  testing.resetPendingTerminalWritesForTest();
  closeOpenClawStateDatabaseForTest();
  if (originalStateDir === undefined) {
    delete process.env["QUIET_CORE_STATE_DIR"];
  } else {
    process.env["QUIET_CORE_STATE_DIR"] = originalStateDir;
  }
});

describe("agent run ledger", () => {
  it("records a started run as running under the current process", () => {
    recordAgentRunStarted({
      runId: "run-start",
      sessionId: "session-1",
      sessionKey: "agent:main:session-1",
    });

    const row = readAgentRun("run-start");
    expect(row).toMatchObject({
      run_id: "run-start",
      session_id: "session-1",
      session_key: "agent:main:session-1",
      status: "running",
      ended_at: null,
      ended_reason: null,
      owner_pid: process.pid,
      owner_instance_id: testing.processInstanceId,
    });
    expect(Number(row?.started_at)).toBeGreaterThan(0);
  });

  it("marks a completed run ok and keeps the first terminal decision", () => {
    recordAgentRunStarted({ runId: "run-ok", sessionKey: "agent:main:ok" });
    recordAgentRunEnded({ runId: "run-ok", status: "ok", endedReason: "run_completed" });

    expect(listAgentRuns({ status: "ok" }).map((entry) => entry.runId)).toEqual(["run-ok"]);
    const completed = readAgentRun("run-ok");
    expect(completed).toMatchObject({ status: "ok", ended_reason: "run_completed" });
    expect(Number(completed?.ended_at)).toBeGreaterThan(0);

    // A late terminal write must not overwrite the recorded outcome.
    recordAgentRunEnded({ runId: "run-ok", status: "abandoned", endedReason: "stuck_recovery" });
    expect(readAgentRun("run-ok")).toMatchObject({
      status: "ok",
      ended_reason: "run_completed",
    });
  });

  it("ignores terminal writes for runs that never started", () => {
    expect(() =>
      recordAgentRunEnded({ runId: "run-missing", status: "ok", endedReason: "run_completed" }),
    ).not.toThrow();
    expect(readAgentRun("run-missing")).toBeUndefined();
  });

  it("queues a terminal write that failed while the state database was locked and replays it", () => {
    recordAgentRunStarted({ runId: "run-locked", sessionKey: "agent:main:locked" });
    testing.failNextTerminalWrites(1);

    recordAgentRunEnded({
      runId: "run-locked",
      status: "timeout",
      endedReason: "idle_watchdog",
    });

    // The failed write leaves the row `running`, but it is queued for compensation
    // instead of being dropped.
    expect(readAgentRun("run-locked")).toMatchObject({ status: "running" });
    expect(testing.pendingTerminalWriteRunIdsForTest()).toEqual(["run-locked"]);

    expect(testing.flushPendingTerminalWritesForTest()).toBe(1);
    expect(readAgentRun("run-locked")).toMatchObject({
      status: "timeout",
      ended_reason: "idle_watchdog",
    });
    expect(testing.pendingTerminalWriteRunIdsForTest()).toEqual([]);
  });

  it("keeps replaying until the lock clears and never overwrites the compensated outcome", () => {
    recordAgentRunStarted({ runId: "run-retry", sessionKey: "agent:main:retry" });
    testing.failNextTerminalWrites(2);

    recordAgentRunEnded({ runId: "run-retry", status: "failed", endedReason: "provider_error" });
    expect(testing.flushPendingTerminalWritesForTest()).toBe(0);
    expect(readAgentRun("run-retry")).toMatchObject({ status: "running" });

    expect(testing.flushPendingTerminalWritesForTest()).toBe(1);
    expect(readAgentRun("run-retry")).toMatchObject({
      status: "failed",
      ended_reason: "provider_error",
    });

    // A late terminal write for the same run must not reopen or overwrite it.
    recordAgentRunEnded({ runId: "run-retry", status: "ok", endedReason: "run_completed" });
    expect(readAgentRun("run-retry")).toMatchObject({ status: "failed" });
    expect(testing.pendingTerminalWriteRunIdsForTest()).toEqual([]);
  });

  it("A12: survives a crash window — a persisted terminal decision is replayed before the sweep", () => {
    recordAgentRunStarted({ runId: "run-crash", sessionKey: "agent:main:crash" });
    testing.failNextTerminalWrites(1);
    recordAgentRunEnded({ runId: "run-crash", status: "ok", endedReason: "run_completed" });

    // The write failed: the row is still `running` and the decision is queued AND on disk.
    expect(readAgentRun("run-crash")).toMatchObject({ status: "running" });
    expect(testing.pendingTerminalWriteRunIdsForTest()).toEqual(["run-crash"]);
    expect(testing.persistedPendingTerminalWriteRunIdsForTest()).toEqual(["run-crash"]);

    // Simulate the process dying inside the compensation window: in-memory queue gone, file intact.
    testing.simulateProcessCrashForTest();
    testing.resetSweepStateForTest();
    expect(testing.pendingTerminalWriteRunIdsForTest()).toEqual([]);

    // The next process's first ledger touch replays the persisted decision BEFORE the sweep, so the
    // real outcome wins over the `interrupted` sweep.
    expect(maybeSweepStaleAgentRuns("gateway restart")).toBe(0);
    expect(readAgentRun("run-crash")).toMatchObject({
      status: "ok",
      ended_reason: "run_completed",
    });
    expect(testing.persistedPendingTerminalWriteRunIdsForTest()).toEqual([]);
  });

  it("A12: the sweep still closes a crashed run when no terminal decision was persisted", () => {
    insertAgentRun({ runId: "run-no-decision", status: "running", ownerPid: null });
    testing.simulateProcessCrashForTest();
    testing.resetSweepStateForTest();

    expect(maybeSweepStaleAgentRuns("gateway restart")).toBe(1);
    expect(readAgentRun("run-no-decision")).toMatchObject({
      status: "interrupted",
      ended_reason: "gateway restart",
    });
  });

  it("sweeps running rows left by a previous process to interrupted", () => {
    insertAgentRun({ runId: "run-orphan", status: "running", ownerPid: null });
    insertAgentRun({ runId: "run-own", status: "running", ownerPid: process.pid });
    insertAgentRun({ runId: "run-dead", status: "running", ownerPid: 4242 });

    const marked = sweepStaleAgentRuns({ isOwnerAlive: (pid) => pid !== 4242 });

    expect(marked).toBe(2);
    expect(readAgentRun("run-orphan")).toMatchObject({
      status: "interrupted",
      ended_reason: "gateway restart",
    });
    expect(readAgentRun("run-dead")).toMatchObject({
      status: "interrupted",
      ended_reason: "gateway restart",
    });
    // The live owner keeps its run so a query process never closes it.
    expect(readAgentRun("run-own")).toMatchObject({ status: "running", ended_reason: null });
  });

  it("keeps live runs when the default liveness check is used", () => {
    insertAgentRun({ runId: "run-live", status: "running", ownerPid: process.pid });
    insertAgentRun({ runId: "run-unknown-owner", status: "running", ownerPid: null });

    expect(sweepStaleAgentRuns()).toBe(1);
    expect(readAgentRun("run-live")).toMatchObject({ status: "running" });
    expect(readAgentRun("run-unknown-owner")).toMatchObject({ status: "interrupted" });
  });

  it("sweeps at most once per process", () => {
    insertAgentRun({ runId: "run-once", status: "running", ownerPid: null });

    expect(maybeSweepStaleAgentRuns()).toBe(1);
    expect(maybeSweepStaleAgentRuns()).toBe(0);
  });

  it("lists newest runs first and filters by session key, status, and limit", () => {
    recordAgentRunStarted({ runId: "run-a", sessionKey: "agent:main:a", startedAt: 100 });
    recordAgentRunStarted({ runId: "run-b", sessionKey: "agent:main:b", startedAt: 200 });
    recordAgentRunEnded({ runId: "run-b", status: "ok", endedReason: "run_completed" });
    recordAgentRunStarted({ runId: "run-c", sessionKey: "agent:main:a", startedAt: 300 });

    expect(listAgentRuns({ limit: 3 }).map((entry) => entry.runId)).toEqual([
      "run-c",
      "run-b",
      "run-a",
    ]);
    expect(listAgentRuns({ status: "ok" }).map((entry) => entry.runId)).toEqual(["run-b"]);
    expect(listAgentRuns({ sessionKey: "agent:main:a" }).map((entry) => entry.runId)).toEqual([
      "run-c",
      "run-a",
    ]);
    expect(listAgentRuns({ status: "interrupted" })).toEqual([]);
  });
});
