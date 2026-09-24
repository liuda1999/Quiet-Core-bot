// A19: preflight compaction is wired into the cli-runner single-shot run
// before-phase. These tests assert the seam is invoked without changing the
// existing CLI run semantics (the shared helper intentionally skips CLI
// runtimes, so behavior is preserved).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliOutput } from "./cli-output.js";

const { runPreflightCompactionIfNeededMock, executePreparedCliRunMock, prepareCliRunContextMock } =
  vi.hoisted(() => {
    return {
      runPreflightCompactionIfNeededMock: vi.fn<(_params: unknown) => Promise<unknown>>(
        async () => undefined,
      ),
      executePreparedCliRunMock: vi.fn<
        (_context: unknown, _cliSessionIdToUse?: string) => Promise<CliOutput>
      >(async () => ({ text: "done" })),
      prepareCliRunContextMock: vi.fn(),
    };
  });

vi.mock("../auto-reply/reply/agent-runner-memory.js", () => ({
  runPreflightCompactionIfNeeded: runPreflightCompactionIfNeededMock,
}));

vi.mock("./cli-runner/prepare.runtime.js", () => ({
  prepareCliRunContext: prepareCliRunContextMock,
}));

vi.mock("./cli-runner/execute.runtime.js", () => ({
  executePreparedCliRun: executePreparedCliRunMock,
}));

const baseRunParams = {
  sessionId: "pre-session",
  sessionKey: "pre-session-key",
  agentId: "main",
  sessionFile: "/tmp/pre-session.jsonl",
  workspaceDir: "/tmp/pre-workspace",
  prompt: "hello",
  provider: "claude-cli",
  model: "sonnet",
  timeoutMs: 30_000,
  runId: "pre-run-id",
  persistAssistantTranscript: true,
} as const;

let runCliAgent: typeof import("./cli-runner.js").runCliAgent;

beforeEach(() => {
  runPreflightCompactionIfNeededMock.mockReset();
  executePreparedCliRunMock.mockReset();
  executePreparedCliRunMock.mockResolvedValue({ text: "done" });
  prepareCliRunContextMock.mockReset();
});

beforeAll(async () => {
  ({ runCliAgent } = await import("./cli-runner.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("cli-runner preflight compaction seam (A19)", () => {
  it("invokes runPreflightCompactionIfNeeded before CLI preparation when a sessionKey is present", async () => {
    prepareCliRunContextMock.mockImplementation(async (params: unknown) => ({
      params,
      started: Date.now(),
      workspaceDir: baseRunParams.workspaceDir,
      modelId: baseRunParams.model,
      normalizedModel: baseRunParams.model,
      systemPrompt: "",
      systemPromptReport: {},
      bootstrapPromptWarningLines: [],
      authEpochVersion: 0,
      backendResolved: {},
      preparedBackend: {},
      reusableCliSession: {},
    }));

    const result = await runCliAgent({ ...baseRunParams });

    expect(runPreflightCompactionIfNeededMock).toHaveBeenCalledTimes(1);
    const preflightParams = runPreflightCompactionIfNeededMock.mock.calls[0]?.[0] as {
      sessionKey?: string;
      followupRun?: { prompt?: string; run?: { provider?: string } };
    };
    expect(preflightParams?.sessionKey).toBe("pre-session-key");
    expect(preflightParams?.followupRun?.prompt).toBe("hello");
    expect(result.meta.finalAssistantVisibleText).toBe("done");
  });

  it("skips preflight when no sessionKey is set (no call, run unchanged)", async () => {
    prepareCliRunContextMock.mockImplementation(async (params: unknown) => ({
      params,
      started: Date.now(),
      workspaceDir: "/tmp/w",
      modelId: baseRunParams.model,
      normalizedModel: baseRunParams.model,
      systemPrompt: "",
      systemPromptReport: {},
      bootstrapPromptWarningLines: [],
      authEpochVersion: 0,
      backendResolved: {},
      preparedBackend: {},
      reusableCliSession: {},
    }));

    const result = await runCliAgent({ ...baseRunParams, sessionKey: undefined });

    expect(runPreflightCompactionIfNeededMock).not.toHaveBeenCalled();
    expect(result.meta.finalAssistantVisibleText).toBe("done");
  });

  it("does not fail the CLI run when preflight compaction throws", async () => {
    runPreflightCompactionIfNeededMock.mockRejectedValueOnce(new Error("preflight exploded"));
    prepareCliRunContextMock.mockImplementation(async (params: unknown) => ({
      params,
      started: Date.now(),
      workspaceDir: "/tmp/w",
      modelId: baseRunParams.model,
      normalizedModel: baseRunParams.model,
      systemPrompt: "",
      systemPromptReport: {},
      bootstrapPromptWarningLines: [],
      authEpochVersion: 0,
      backendResolved: {},
      preparedBackend: {},
      reusableCliSession: {},
    }));

    const result = await runCliAgent({ ...baseRunParams });

    expect(result.meta.finalAssistantVisibleText).toBe("done");
  });
});
