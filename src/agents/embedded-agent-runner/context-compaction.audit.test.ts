import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Batch K1 · Task 2 — multi-turn context compaction audit.
//
// Audits the real compaction pipeline deterministically (no live model):
//   (1) a multi-turn history that exceeds `keepRecentTokens` triggers compaction
//       and appends a non-truncating `compaction` row;
//   (2) the resulting transcript is structurally stable / fully parseable;
//   (3) anchor facts (KEYFACT-*) from the summarised region reach the summary body;
//   (4) no degenerate summary is adopted;
//   (5) when summarization fails, the original transcript is preserved (no row
//       appended, live context not truncated) — the D7 contract;
//   (6) the mid-turn precheck tool-result boundary flips the route into compaction;
//   (7) F8: a transcript with no summarisable region spends no provider call and
//       logs `[compaction-nothing-to-compact]`;
//   (8) `agent.state.messages` is rebuilt from the transcript after compaction.
import type { Model } from "../../llm/types.js";
import { loggingState } from "../../logging/state.js";

const streamMocks = vi.hoisted(() => ({
  streamSimple: vi.fn(),
}));

vi.mock("../../llm/stream.js", () => ({
  streamSimple: streamMocks.streamSimple,
}));

import { AuthStorage } from "../sessions/auth-storage.js";
import { createExtensionRuntime } from "../sessions/extensions/loader.js";
import type { LoadExtensionsResult } from "../sessions/extensions/types.js";
import { ModelRegistry } from "../sessions/model-registry.js";
import type { ResourceLoader } from "../sessions/resource-loader.js";
import { createAgentSession } from "../sessions/sdk.js";
import { parseSessionEntries, SessionManager } from "../sessions/session-manager.js";
import { SettingsManager } from "../sessions/settings-manager.js";
import { detectDegenerateCompactionSummary } from "./compaction-summary-health.js";
import {
  formatPrePromptPrecheckLog,
  shouldPreemptivelyCompactBeforePrompt,
} from "./run/preemptive-compaction.js";

const testModel: Model = {
  id: "test-model",
  name: "Test Model",
  api: "openai-responses",
  provider: "test-provider",
  baseUrl: "https://example.test",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 4000,
  maxTokens: 4000,
};

function makeResourceLoader(): ReturnType<typeof createEmptyResourceLoader> {
  const extensionsResult: LoadExtensionsResult = {
    extensions: [],
    errors: [],
    runtime: createExtensionRuntime(),
  };
  return {
    getExtensions: () => extensionsResult,
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => undefined,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function createEmptyResourceLoader(): ResourceLoader {
  return makeResourceLoader();
}

function assistantResult(text: string, stopReason: "stop" | "error" = "stop") {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason,
    ...(stopReason === "error" ? { errorMessage: "summarization failed" } : {}),
    usage: { input: 10, output: text.length, total: 10 + text.length },
  };
}

function userMessage(text: string) {
  return { role: "user", content: [{ type: "text", text }], timestamp: Date.now() } as never;
}

function assistantMessage(text: string) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "anthropic-messages",
    provider: "test-provider",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  } as never;
}

/**
 * Builds a live AgentSession whose transcript has `turns` user/assistant turns.
 * The first turn carries the anchor facts so a compaction of the older region
 * must surface them into the summary prompt.
 */
async function buildSessionWithHistory(params: {
  turns: number;
  keepRecentTokens: number;
  reserveTokens?: number;
  anchors?: string[];
}) {
  const authStorage = AuthStorage.inMemory();
  authStorage.setRuntimeApiKey("test-provider", "sk-test");
  const sessionManager = SessionManager.inMemory();

  const anchors = params.anchors ?? ["KEYFACT-ALPHA", "KEYFACT-BETA"];
  sessionManager.appendMessage(
    userMessage(`Please remember these anchors: ${anchors.join(" ")}. ${"a".repeat(400)}`),
  );
  sessionManager.appendMessage(assistantMessage("Understood, I will keep the anchors."));
  for (let i = 1; i < params.turns; i += 1) {
    sessionManager.appendMessage(userMessage(`Follow-up turn ${i}: ${"b".repeat(400)}`));
    sessionManager.appendMessage(assistantMessage(`Acknowledged turn ${i}.`));
  }

  const { session } = await createAgentSession({
    model: testModel,
    resourceLoader: createEmptyResourceLoader(),
    sessionManager,
    settingsManager: SettingsManager.inMemory({
      compaction: {
        enabled: true,
        reserveTokens: params.reserveTokens ?? 1000,
        keepRecentTokens: params.keepRecentTokens,
      },
    }),
    modelRegistry: ModelRegistry.inMemory(authStorage),
  });
  session.agent.state.messages = sessionManager
    .getEntries()
    .flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
  return { session, sessionManager, anchors };
}

/** streamSimple that echoes every KEYFACT-* found in the summarization prompt. */
function echoAnchorsStream() {
  return vi.fn((_model?: unknown, context?: unknown) => ({
    result: async () => {
      const prompt = JSON.stringify(context ?? "");
      const anchors = [...prompt.matchAll(/KEYFACT-[A-Z]+/g)].map((match) => match[0]);
      return assistantResult(
        ["## Goal", "Preserve the anchors from the earlier conversation:", ...anchors].join("\n"),
      );
    },
  }));
}

let consoleWarn = vi.fn();
let consoleLog = vi.fn();
let consoleError = vi.fn();
let consoleInfo = vi.fn();

beforeEach(() => {
  streamMocks.streamSimple.mockReset();
  consoleWarn = vi.fn();
  consoleLog = vi.fn();
  consoleError = vi.fn();
  consoleInfo = vi.fn();
  // Vitest runs default the console logger to "silent"; force warn-level console
  // output so the compaction skip warning is observable through rawConsole.
  loggingState.overrideSettings = { consoleLevel: "warn" };
  loggingState.rawConsole = {
    log: consoleLog as unknown as typeof console.log,
    info: consoleInfo as unknown as typeof console.info,
    warn: consoleWarn as unknown as typeof console.warn,
    error: consoleError as unknown as typeof console.error,
  };
});

afterEach(() => {
  loggingState.rawConsole = null;
  loggingState.overrideSettings = null;
  loggingState.cachedConsoleSettings = null;
});

function capturedWarnings(): string {
  return consoleWarn.mock.calls.map((call) => String(call[0] ?? "")).join("\n");
}

describe("Task 2 · multi-turn context compaction audit", () => {
  it("compacts a history that exceeds keepRecentTokens and preserves anchor facts", async () => {
    streamMocks.streamSimple.mockImplementation(echoAnchorsStream());
    const { session, sessionManager, anchors } = await buildSessionWithHistory({
      turns: 6,
      keepRecentTokens: 60,
    });

    const result = await session.compact();

    // (1) A compaction row exists — the non-truncation summary path was taken.
    const entries = sessionManager.getEntries();
    const compaction = entries.find((entry) => entry.type === "compaction");
    expect(compaction).toBeDefined();
    expect(compaction?.type).toBe("compaction");
    expect(streamMocks.streamSimple).toHaveBeenCalled();

    // (3) Anchor facts survive into the summary body.
    for (const anchor of anchors) {
      expect(result.summary).toContain(anchor);
    }

    // (4) The adopted summary is not degenerate.
    expect(detectDegenerateCompactionSummary(result.summary).degenerate).toBe(false);

    // (2) The serialized transcript is fully parseable (parseErrors=0).
    const lines = entries.map((entry) => JSON.stringify(entry));
    const parsed = parseSessionEntries(lines.join("\n"));
    expect(parsed).toHaveLength(entries.length);
    expect(parsed.filter((entry) => entry.type === "compaction")).toHaveLength(1);

    // (8) agent.state.messages is rebuilt from the transcript, not the stale array.
    const rebuilt = sessionManager.buildSessionContext().messages;
    expect(session.agent.state.messages).toEqual(rebuilt);
    expect((session.agent.state.messages[0] as { role?: string }).role).toBe("compactionSummary");
    const summaryMessage = session.agent.state.messages[0] as { summary?: string };
    expect(summaryMessage.summary).toContain(anchors[0]);
  });

  it("keeps the original transcript when summarization fails (D7)", async () => {
    // Summarization returns an error stop reason => the compaction core fails.
    streamMocks.streamSimple.mockImplementation(() => ({
      result: async () => assistantResult("ignored", "error"),
    }));
    const { session, sessionManager } = await buildSessionWithHistory({
      turns: 6,
      keepRecentTokens: 60,
    });

    const before = sessionManager.getEntries();
    const beforeTypes = before.map((entry) => entry.type);

    await expect(session.compact()).rejects.toBeTruthy();

    const after = sessionManager.getEntries();
    // No compaction row was committed: nothing replaced the original history.
    expect(after.map((entry) => entry.type)).toEqual(beforeTypes);
    expect(after.some((entry) => entry.type === "compaction")).toBe(false);
  });

  it("spends no provider call and warns when there is nothing to compact (F8)", async () => {
    streamMocks.streamSimple.mockImplementation(echoAnchorsStream());
    // Huge keepRecentTokens keeps the whole transcript "recent" => no droppable region.
    const { session, sessionManager } = await buildSessionWithHistory({
      turns: 2,
      keepRecentTokens: 1_000_000,
    });

    await expect(session.compact()).rejects.toThrow(/Nothing to compact/i);

    // F8: no summarization request was issued.
    expect(streamMocks.streamSimple).not.toHaveBeenCalled();
    // F8: the skip is observable, not silent.
    expect(capturedWarnings()).toContain("[compaction-nothing-to-compact]");
    // And no compaction row was appended.
    expect(sessionManager.getEntries().some((entry) => entry.type === "compaction")).toBe(false);
  });
});

describe("Task 2 · mid-turn precheck compaction boundary", () => {
  it("routes to compaction once a tool result pushes the next prompt over budget", () => {
    const smallToolResult = {
      role: "toolResult",
      toolCallId: "call-small",
      toolName: "exec",
      content: [{ type: "text", text: "ok" }],
      isError: false,
      timestamp: 1,
    } as never;
    const hugeToolResult = {
      role: "toolResult",
      toolCallId: "call-huge",
      toolName: "exec",
      content: [{ type: "text", text: "X".repeat(200_000) }],
      isError: false,
      timestamp: 2,
    } as never;

    const budget = { contextTokenBudget: 20_000, reserveTokens: 4_000 };
    const fits = shouldPreemptivelyCompactBeforePrompt({
      messages: [userMessage("hello"), smallToolResult],
      prompt: "continue",
      ...budget,
    });
    const pushed = shouldPreemptivelyCompactBeforePrompt({
      messages: [userMessage("hello"), hugeToolResult],
      prompt: "continue",
      ...budget,
    });

    // Before the boundary the prompt fits; the tool result is what tips it over.
    expect(fits.route).toBe("fits");
    expect(fits.shouldCompact).toBe(false);
    expect(pushed.route).not.toBe("fits");
    expect(pushed.shouldCompact).toBe(true);
    expect(pushed.overflowTokens).toBeGreaterThan(0);

    // The precheck decision is observable in the operator log line.
    const logLine = formatPrePromptPrecheckLog({
      result: pushed,
      provider: "test-provider",
      modelId: "test-model",
      messageCount: 2,
      ...budget,
    });
    expect(logLine).toContain(`route=${pushed.route}`);
    expect(["compact_only", "compact_then_truncate"]).toContain(pushed.route);
  });
});
