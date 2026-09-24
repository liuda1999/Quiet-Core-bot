// Subagents tool tests cover requester-scoped listing guidance, numeric
// status-window validation, and terminal result joins from the persisted
// subagent_runs table.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeOpenClawStateDatabaseForTest } from "../../state/openclaw-state-db.js";
import { withEnvAsync } from "../../test-utils/env.js";
import { testing as subagentAnnounceOutputTesting } from "../subagent-announce-output.js";
import { saveSubagentRegistryToSqlite } from "../subagent-registry.store.sqlite.js";
import type { SubagentRunRecord } from "../subagent-registry.types.js";
import { createSubagentsTool } from "./subagents-tool.js";

type ToolResultPayload = {
  status?: string;
  action?: string;
  error?: string;
  run?: {
    status?: string;
    runId?: string;
    childSessionKey?: string;
    startedAt?: number;
    endedAt?: number;
    errorSummary?: string;
    toolFailures?: Array<{ tool?: string; error?: string }>;
    resultText?: string;
  };
};

function readToolPayload(result: { details?: unknown }): ToolResultPayload {
  return result.details as ToolResultPayload;
}

function createRun(overrides: Partial<SubagentRunRecord> = {}): SubagentRunRecord {
  return {
    runId: "run-join-1",
    childSessionKey: "agent:main:subagent:worker",
    requesterSessionKey: "agent:main:main",
    requesterDisplayKey: "main",
    task: "summarize the log",
    cleanup: "keep",
    createdAt: 100,
    startedAt: 110,
    endedAt: 250,
    outcome: { status: "error", error: "child crashed", startedAt: 110, endedAt: 250 },
    expectsCompletionMessage: true,
    completion: {
      required: true,
      resultText: "partial output before the crash",
      capturedAt: 260,
    },
    ...overrides,
  };
}

describe("subagents tool", () => {
  it("advertises the result action without promising sessions_yield", () => {
    // sessions_yield is context-dependent; the model-facing description should
    // not promise it exists in every runtime.
    const tool = createSubagentsTool();

    expect(tool.description).toBe(
      'Observe and join only: list active/recent subagents for the requester session, or read one subagent run terminal result with action="result". This tool never starts work — use sessions_spawn to dispatch a subagent. If sessions_yield exists, use it for completion; do not poll wait loops.',
    );
  });

  it("points at sessions_spawn for dispatch and keeps the result action documented", () => {
    const tool = createSubagentsTool();

    expect(tool.description).toContain("use sessions_spawn to dispatch");
    expect(tool.description).toContain('action="result"');
    expect(tool.description).toContain("never starts work");
  });

  it.each([0, 1.5])("rejects invalid recentMinutes value %s", async (recentMinutes) => {
    const tool = createSubagentsTool();

    await expect(
      tool.execute("call-1", {
        action: "list",
        recentMinutes,
      }),
    ).rejects.toThrow("recentMinutes must be a positive integer");
  });

  describe("action=result joins", () => {
    let tempStateDir: string | null = null;

    beforeEach(async () => {
      tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-subagents-tool-"));
    });

    afterEach(async () => {
      subagentAnnounceOutputTesting.setDepsForTest();
      closeOpenClawStateDatabaseForTest();
      if (tempStateDir) {
        await fs.rm(tempStateDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
        tempStateDir = null;
      }
    });

    async function withStateDir<T>(fn: () => Promise<T>): Promise<T> {
      if (!tempStateDir) {
        throw new Error("expected temp state dir");
      }
      return await withEnvAsync({ OPENCLAW_STATE_DIR: tempStateDir }, fn);
    }

    it("returns the persisted terminal result for a controlled run", async () => {
      subagentAnnounceOutputTesting.setDepsForTest({
        callGateway: (async () => ({
          messages: [
            {
              role: "toolResult",
              toolCallId: "call-1",
              toolName: "read",
              isError: true,
              content: [{ type: "text", text: "ENOENT: no such file or directory" }],
            },
          ],
        })) as unknown as typeof import("../subagent-announce.runtime.js").callGateway,
      });

      await withStateDir(async () => {
        saveSubagentRegistryToSqlite(new Map([["run-join-1", createRun()]]));
        const tool = createSubagentsTool({ agentSessionKey: "agent:main:main" });

        const payload = readToolPayload(
          await tool.execute("call-1", { action: "result", runId: "run-join-1" }),
        );

        expect(payload.status).toBe("ok");
        expect(payload.run?.status).toBe("error");
        expect(payload.run?.childSessionKey).toBe("agent:main:subagent:worker");
        expect(payload.run?.startedAt).toBe(110);
        expect(payload.run?.endedAt).toBe(250);
        expect(payload.run?.errorSummary).toBe("child crashed; 1 tool call failed");
        expect(payload.run?.toolFailures).toEqual([
          { tool: "read", error: "ENOENT: no such file or directory" },
        ]);
        expect(payload.run?.resultText).toBe("partial output before the crash");
      });
    });

    it("resolves the latest run for a child session key", async () => {
      await withStateDir(async () => {
        saveSubagentRegistryToSqlite(
          new Map([
            ["run-old", createRun({ runId: "run-old", createdAt: 100, outcome: { status: "ok" } })],
            [
              "run-new",
              createRun({
                runId: "run-new",
                createdAt: 200,
                outcome: { status: "timeout", error: undefined },
              }),
            ],
          ]),
        );
        const tool = createSubagentsTool({ agentSessionKey: "agent:main:main" });

        const payload = readToolPayload(
          await tool.execute("call-1", {
            action: "result",
            childSessionKey: "agent:main:subagent:worker",
          }),
        );

        expect(payload.status).toBe("ok");
        expect(payload.run?.runId).toBe("run-new");
        expect(payload.run?.status).toBe("timeout");
      });
    });

    it("reports a clear not-found result instead of throwing", async () => {
      await withStateDir(async () => {
        const tool = createSubagentsTool({ agentSessionKey: "agent:main:main" });

        const payload = readToolPayload(
          await tool.execute("call-1", { action: "result", runId: "run-missing" }),
        );

        expect(payload.status).toBe("not_found");
        expect(payload.action).toBe("result");
        expect(payload.error).toContain("No subagent run found");
      });
    });

    it("requires a run id or child session key", async () => {
      const tool = createSubagentsTool({ agentSessionKey: "agent:main:main" });

      const payload = readToolPayload(await tool.execute("call-1", { action: "result" }));

      expect(payload.status).toBe("error");
      expect(payload.error).toBe("runId or childSessionKey required.");
    });

    it("rejects runs owned by another controller session", async () => {
      await withStateDir(async () => {
        saveSubagentRegistryToSqlite(
          new Map([
            [
              "run-foreign",
              createRun({
                runId: "run-foreign",
                requesterSessionKey: "agent:other:main",
                controllerSessionKey: "agent:other:main",
              }),
            ],
          ]),
        );
        const tool = createSubagentsTool({ agentSessionKey: "agent:main:main" });

        const payload = readToolPayload(
          await tool.execute("call-1", { action: "result", runId: "run-foreign" }),
        );

        expect(payload.status).toBe("forbidden");
        expect(payload.error).toBe("Subagents can only read runs spawned from their own session.");
      });
    });
  });
});
