// Doctor agent-run ledger tests cover the interrupted-run note and safe-restart hint.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunLedgerEntry } from "../state/agent-runs-store.js";

const note = vi.hoisted(() => vi.fn());

vi.mock("../../packages/terminal-core/src/note.js", () => ({
  note,
}));

import { noteAgentRunLedgerHealth } from "./doctor-agent-runs.js";

function interruptedRun(overrides: Partial<AgentRunLedgerEntry> = {}): AgentRunLedgerEntry {
  return {
    runId: "run-1",
    sessionKey: "agent:main:main",
    sessionId: "session-1",
    status: "interrupted",
    startedAt: 1,
    endedAt: 2,
    endedReason: "gateway restart",
    updatedAt: 2,
    ...overrides,
  };
}

function firstNoteCall(): [string, string] {
  const call = note.mock.calls[0];
  if (!call) {
    throw new Error("expected note call");
  }
  return call as [string, string];
}

describe("noteAgentRunLedgerHealth", () => {
  beforeEach(() => {
    note.mockClear();
  });

  it("stays quiet when no run was interrupted", async () => {
    await noteAgentRunLedgerHealth({ listRuns: () => [] });

    expect(note).not.toHaveBeenCalled();
  });

  it("lists interrupted runs and points at the safe restart path", async () => {
    await noteAgentRunLedgerHealth({ listRuns: () => [interruptedRun()] });

    const [message, title] = firstNoteCall();
    expect(title).toBe("Agent runs");
    expect(message).toContain("run-1");
    expect(message).toContain("status=interrupted");
    expect(message).toContain("session=agent:main:main");
    expect(message).toContain("reason=gateway restart");
    expect(message).toContain("gateway restart --safe");
  });

  it("reports inspection failures instead of throwing", async () => {
    await noteAgentRunLedgerHealth({
      listRuns: () => {
        throw new Error("db locked");
      },
    });

    expect(firstNoteCall()[0]).toContain("Failed to inspect persisted agent runs");
  });
});
