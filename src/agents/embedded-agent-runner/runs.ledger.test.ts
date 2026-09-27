// Embedded run ledger tests cover agent_runs rows written by run registry transitions.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listAgentRuns } from "../../state/agent-runs-store.js";
import { closeOpenClawStateDatabaseForTest } from "../../state/quiet-core-bot-state-db.js";
import {
  testing,
  clearActiveEmbeddedRun,
  forceClearEmbeddedAgentRun,
  markEmbeddedRunAbandoned,
  setActiveEmbeddedRun,
} from "./runs.js";

type RunHandle = Parameters<typeof setActiveEmbeddedRun>[1];

const originalStateDir = process.env["QUIET_CORE_STATE_DIR"];
let stateDir: string;

function createRunHandle(): RunHandle {
  return {
    queueMessage: async () => {},
    isStreaming: () => true,
    isCompacting: () => false,
    abort: () => {},
  };
}

function readRun(sessionKey: string) {
  const entries = listAgentRuns({ sessionKey });
  expect(entries).toHaveLength(1);
  return entries[0];
}

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot-embedded-run-ledger-"));
  process.env["QUIET_CORE_STATE_DIR"] = stateDir;
});

afterEach(() => {
  testing.resetActiveEmbeddedRuns();
  closeOpenClawStateDatabaseForTest();
  if (originalStateDir === undefined) {
    delete process.env["QUIET_CORE_STATE_DIR"];
  } else {
    process.env["QUIET_CORE_STATE_DIR"] = originalStateDir;
  }
});

describe("embedded run ledger transitions", () => {
  it("records a run start as running", () => {
    setActiveEmbeddedRun(
      "ledger-running",
      createRunHandle(),
      "agent:main:ledger-running",
      undefined,
      "ledger-run-running",
    );

    expect(readRun("agent:main:ledger-running")).toMatchObject({
      runId: "ledger-run-running",
      sessionId: "ledger-running",
      status: "running",
      endedAt: null,
      endedReason: null,
    });
  });

  it("records a normal completion as ok", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun("ledger-ok", handle, "agent:main:ledger-ok", undefined, "ledger-run-ok");
    clearActiveEmbeddedRun("ledger-ok", handle, "agent:main:ledger-ok");

    const entry = readRun("agent:main:ledger-ok");
    expect(entry).toMatchObject({
      runId: "ledger-run-ok",
      status: "ok",
      endedReason: "run_completed",
    });
    expect(entry.endedAt).toBeTypeOf("number");
  });

  it("records a force clear as abandoned", () => {
    setActiveEmbeddedRun(
      "ledger-forced",
      createRunHandle(),
      "agent:main:ledger-forced",
      undefined,
      "ledger-run-forced",
    );
    expect(
      forceClearEmbeddedAgentRun("ledger-forced", "agent:main:ledger-forced", "stuck_recovery"),
    ).toBe(true);

    expect(readRun("agent:main:ledger-forced")).toMatchObject({
      runId: "ledger-run-forced",
      status: "abandoned",
      endedReason: "stuck_recovery",
    });
  });

  it("records an abandoned run as timeout", () => {
    setActiveEmbeddedRun(
      "ledger-timeout",
      createRunHandle(),
      "agent:main:ledger-timeout",
      undefined,
      "ledger-run-timeout",
    );
    markEmbeddedRunAbandoned({
      sessionId: "ledger-timeout",
      sessionKey: "agent:main:ledger-timeout",
      reason: "timeout",
    });

    expect(readRun("agent:main:ledger-timeout")).toMatchObject({
      runId: "ledger-run-timeout",
      status: "timeout",
      endedReason: "timeout",
    });
  });

  it("falls back to the session id and notes it in the ended reason", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun("ledger-fallback", handle, "agent:main:ledger-fallback");
    expect(readRun("agent:main:ledger-fallback")).toMatchObject({
      runId: "ledger-fallback",
      status: "running",
    });

    clearActiveEmbeddedRun("ledger-fallback", handle, "agent:main:ledger-fallback");

    expect(readRun("agent:main:ledger-fallback")).toMatchObject({
      runId: "ledger-fallback",
      status: "ok",
      endedReason: "run_completed (run_id=session_id fallback)",
    });
  });

  it("records an errored run as failed instead of ok", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun(
      "ledger-errored",
      handle,
      "agent:main:ledger-errored",
      undefined,
      "ledger-run-errored",
    );
    clearActiveEmbeddedRun("ledger-errored", handle, "agent:main:ledger-errored", undefined, {
      status: "failed",
      reason: "run_error: timeout (LLM request failed: connection error.)",
    });

    expect(readRun("agent:main:ledger-errored")).toMatchObject({
      runId: "ledger-run-errored",
      status: "failed",
      endedReason: "run_error: timeout (LLM request failed: connection error.)",
    });
  });

  it("records a timed-out run as timeout", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun(
      "ledger-timeout-phase",
      handle,
      "agent:main:ledger-timeout-phase",
      undefined,
      "ledger-run-timeout-phase",
    );
    clearActiveEmbeddedRun(
      "ledger-timeout-phase",
      handle,
      "agent:main:ledger-timeout-phase",
      undefined,
      { status: "timeout", reason: "run_timeout: provider" },
    );

    expect(readRun("agent:main:ledger-timeout-phase")).toMatchObject({
      runId: "ledger-run-timeout-phase",
      status: "timeout",
      endedReason: "run_timeout: provider",
    });
  });

  it("records an explicit ok outcome as ok", () => {
    const handle = createRunHandle();
    setActiveEmbeddedRun(
      "ledger-explicit-ok",
      handle,
      "agent:main:ledger-explicit-ok",
      undefined,
      "ledger-run-explicit-ok",
    );
    clearActiveEmbeddedRun(
      "ledger-explicit-ok",
      handle,
      "agent:main:ledger-explicit-ok",
      undefined,
      {
        status: "ok",
        reason: "run_completed",
      },
    );

    expect(readRun("agent:main:ledger-explicit-ok")).toMatchObject({
      runId: "ledger-run-explicit-ok",
      status: "ok",
      endedReason: "run_completed",
    });
  });

  it("keeps probe sessions out of the ledger", () => {
    setActiveEmbeddedRun("probe-ledger", createRunHandle(), "agent:main:ledger-probe");

    expect(listAgentRuns({ sessionKey: "agent:main:ledger-probe" })).toEqual([]);
  });
});
