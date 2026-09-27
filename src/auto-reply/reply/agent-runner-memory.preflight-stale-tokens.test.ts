import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testing as cliBackendsTesting } from "../../agents/cli-backends.js";
import type { SessionEntry } from "../../config/sessions.js";
import {
  clearMemoryPluginState,
  registerMemoryCapability,
  type MemoryFlushPlanResolver,
} from "../../plugins/memory-state.js";
import {
  runPreflightCompactionIfNeeded,
  setAgentRunnerMemoryTestDeps,
} from "./agent-runner-memory.js";
import { createTestFollowupRun, writeTestSessionStore } from "./agent-runner.test-fixtures.js";
import type { ReplyOperation } from "./reply-run-registry.js";

const preflightLogMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// A19/P3-006: the preflight-compaction skip must be observable in logs, so the
// test asserts on the subsystem logger instead of only on the returned entry.
vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    ...preflightLogMocks,
    trace: vi.fn(),
    raw: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

const compactEmbeddedAgentSessionMock = vi.fn();

function createReplyOperation(): ReplyOperation {
  return {
    key: "test",
    sessionId: "session",
    abortSignal: new AbortController().signal,
    resetTriggered: false,
    phase: "queued",
    result: null,
    setPhase: vi.fn(),
    updateSessionId: vi.fn(),
    attachBackend: vi.fn(),
    detachBackend: vi.fn(),
    retainFailureUntilComplete: vi.fn(),
    complete: vi.fn(),
    completeThen: vi.fn((afterClear: () => void) => {
      afterClear();
    }),
    completeWithAfterClearBarrier: vi.fn(),
    fail: vi.fn(),
    abortByUser: vi.fn(),
    abortForRestart: vi.fn(),
  } as unknown as ReplyOperation;
}

function registerMemoryFlushPlanResolverForTest(resolver: MemoryFlushPlanResolver): void {
  registerMemoryCapability("memory-core", { flushPlanResolver: resolver });
}

describe("runPreflightCompactionIfNeeded stale totalTokens gating", () => {
  let rootDir = "";

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-preflight-stale-"));
    registerMemoryFlushPlanResolverForTest(() => ({
      softThresholdTokens: 4_000,
      forceFlushTranscriptBytes: 1_000_000_000,
      reserveTokensFloor: 20_000,
      prompt: "Pre-compaction memory flush.\nNO_REPLY",
      systemPrompt: "Write memory to memory/YYYY-MM-DD.md.",
      relativePath: "memory/2023-11-14.md",
    }));
    compactEmbeddedAgentSessionMock.mockReset().mockResolvedValue({
      ok: true,
      compacted: true,
      result: { tokensAfter: 42 },
    });
    setAgentRunnerMemoryTestDeps({
      compactEmbeddedAgentSession: compactEmbeddedAgentSessionMock as never,
      incrementCompactionCount: vi.fn() as never,
      refreshQueuedFollowupSession: vi.fn() as never,
      registerAgentRunContext: vi.fn() as never,
      emitAgentEvent: vi.fn() as never,
    });
  });

  afterEach(async () => {
    setAgentRunnerMemoryTestDeps();
    cliBackendsTesting.resetDepsForTest();
    clearMemoryPluginState();
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  async function runWithEntry(sessionEntry: SessionEntry, sessionFile: string) {
    return await runPreflightCompactionIfNeeded({
      cfg: { agents: { defaults: { compaction: { memoryFlush: {} } } } },
      followupRun: createTestFollowupRun({
        sessionId: "session",
        sessionFile,
        sessionKey: "agent:main:main",
      }),
      defaultModel: "anthropic/claude-opus-4-6",
      agentCfgContextTokens: 100_000,
      sessionEntry,
      sessionStore: { "agent:main:main": sessionEntry },
      sessionKey: "agent:main:main",
      storePath: path.join(rootDir, "sessions.json"),
      isHeartbeat: false,
      replyOperation: createReplyOperation(),
    });
  }

  it("does not compact when totalTokens is large but stale and the real transcript is small", async () => {
    const sessionFile = path.join(rootDir, "session.jsonl");
    await fs.writeFile(
      sessionFile,
      `${JSON.stringify({ message: { role: "user", content: "x".repeat(2_000) } })}\n`,
      "utf8",
    );
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      sessionFile,
      updatedAt: Date.now(),
      totalTokens: 200_000,
      totalTokensFresh: false,
    };
    await writeTestSessionStore(
      path.join(rootDir, "sessions.json"),
      "agent:main:main",
      sessionEntry,
    );

    const entry = await runWithEntry(sessionEntry, sessionFile);

    expect(entry).toBe(sessionEntry);
    expect(compactEmbeddedAgentSessionMock).not.toHaveBeenCalled();
  });

  it("records why preflight compaction was skipped for heartbeat and CLI-runtime sessions (A19/P3-006)", async () => {
    // A19/P3-006: this skip used to be silent, so `[preflight-compaction]` looked
    // unreachable. The followup provider selects the CLI runtime, which owns its
    // own precheck (`[context-overflow-precheck]`).
    const sessionFile = path.join(rootDir, "session-skip.jsonl");
    await fs.writeFile(
      sessionFile,
      `${JSON.stringify({ message: { role: "user", content: "hello" } })}\n`,
      "utf8",
    );
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      sessionFile,
      updatedAt: Date.now(),
      totalTokens: 200_000,
      totalTokensFresh: true,
    };
    await writeTestSessionStore(
      path.join(rootDir, "sessions.json"),
      "agent:main:main",
      sessionEntry,
    );
    const baseParams = {
      cfg: {
        agents: {
          defaults: { compaction: { memoryFlush: {} }, cliBackends: { "claude-cli": {} } },
        },
      },
      followupRun: createTestFollowupRun({
        sessionId: "session",
        sessionFile,
        sessionKey: "agent:main:main",
      }),
      defaultModel: "anthropic/claude-opus-4-6",
      agentCfgContextTokens: 100_000,
      sessionEntry,
      sessionStore: { "agent:main:main": sessionEntry },
      sessionKey: "agent:main:main",
      storePath: path.join(rootDir, "sessions.json"),
      replyOperation: createReplyOperation(),
    };

    preflightLogMocks.debug.mockClear();
    await runPreflightCompactionIfNeeded({ ...baseParams, isHeartbeat: true } as never);
    expect(
      preflightLogMocks.debug.mock.calls.some((call) =>
        String(call[0]).includes("[preflight-compaction] skipped"),
      ),
    ).toBe(true);
    expect(
      preflightLogMocks.debug.mock.calls.some((call) =>
        String(call[0]).includes("reason=heartbeat"),
      ),
    ).toBe(true);

    preflightLogMocks.debug.mockClear();
    compactEmbeddedAgentSessionMock.mockClear();
    await runPreflightCompactionIfNeeded({
      ...baseParams,
      followupRun: createTestFollowupRun({
        sessionId: "session",
        sessionFile,
        sessionKey: "agent:main:main",
        provider: "claude-cli",
      }),
      isHeartbeat: false,
    } as never);
    expect(
      preflightLogMocks.debug.mock.calls.some((call) =>
        String(call[0]).includes("reason=cli_runtime_uses_embedded_precheck"),
      ),
    ).toBe(true);
    expect(compactEmbeddedAgentSessionMock).not.toHaveBeenCalled();
  });

  it("compacts when totalTokens is large and fresh", async () => {
    const sessionFile = path.join(rootDir, "session.jsonl");
    await fs.writeFile(
      sessionFile,
      `${JSON.stringify({ message: { role: "user", content: "x".repeat(2_000) } })}\n`,
      "utf8",
    );
    const sessionEntry: SessionEntry = {
      sessionId: "session",
      sessionFile,
      updatedAt: Date.now(),
      totalTokens: 200_000,
      totalTokensFresh: true,
    };
    await writeTestSessionStore(
      path.join(rootDir, "sessions.json"),
      "agent:main:main",
      sessionEntry,
    );

    await runWithEntry(sessionEntry, sessionFile);

    expect(compactEmbeddedAgentSessionMock).toHaveBeenCalledTimes(1);
  });
});
