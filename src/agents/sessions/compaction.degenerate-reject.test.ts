// D9: a degenerate compaction summary (unfilled placeholder / meta-echo) must
// not enter the transcript. The AgentSession compaction commit path rejects it
// (throws CompactionDegenerateError BEFORE appendCompaction) so the original
// messages are retained instead of being replaced by a context-free placeholder.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Model, SimpleStreamOptions } from "../../llm/types.js";
import {
  CompactionDegenerateError,
  detectDegenerateCompactionSummary,
} from "../embedded-agent-runner/compaction-summary-health.js";

const streamMocks = vi.hoisted(() => ({
  streamSimple: vi.fn<(model: Model, context: Context, options?: SimpleStreamOptions) => unknown>(
    () => "stream",
  ),
}));
vi.mock("../../llm/stream.js", () => ({
  streamSimple: streamMocks.streamSimple,
}));

import { AuthStorage } from "./auth-storage.js";
import { createExtensionRuntime } from "./extensions/loader.js";
import type { LoadExtensionsResult, ToolDefinition } from "./extensions/types.js";
import { ModelRegistry } from "./model-registry.js";
import type { ResourceLoader } from "./resource-loader.js";
import { createAgentSession } from "./sdk.js";
import { SessionManager } from "./session-manager.js";
import { SettingsManager } from "./settings-manager.js";
import { createSyntheticSourceInfo } from "./source-info.js";

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

const DEGENERATE_SUMMARY =
  "Please provide the conversation content so I can generate the summary for you! " +
  "Since the conversation content was not provided in your prompt, here is the structure:\n" +
  "## Goal\n[User's primary objectives]";
const REAL_SUMMARY =
  "The user asked to persist scheduler state across restarts. Added a SQLite-backed " +
  "run ledger and verified restart recovery with a regression test.";

function makeResourceLoader(): ReturnType<typeof createEmptyResourceLoader> {
  void new Map<string, Array<(...args: unknown[]) => Promise<unknown>>>();
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

function streamReturning(summaryText: string) {
  return {
    result: async () => ({
      role: "assistant",
      content: [{ type: "text", text: summaryText }],
      stopReason: "stop",
      usage: { input: 10, output: summaryText.length, total: 10 + summaryText.length },
    }),
  };
}

async function buildSessionWithHistory() {
  const authStorage = AuthStorage.inMemory();
  authStorage.setRuntimeApiKey("test-provider", "sk-test");
  const sessionManager = SessionManager.inMemory();
  sessionManager.appendMessage({
    role: "user",
    content: [{ type: "text", text: "Please persist the scheduler state across restarts." }],
    timestamp: Date.now(),
  } as Parameters<SessionManager["appendMessage"]>[0]);
  sessionManager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: "I will look into persisting scheduler state." }],
    api: "messages",
    provider: "anthropic",
    model: "sonnet-4.6",
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
  } as Parameters<SessionManager["appendMessage"]>[0]);
  const { session } = await createAgentSession({
    model: testModel,
    resourceLoader: createEmptyResourceLoader(),
    sessionManager,
    // Keep the recent-token window tiny so this short fixture still exposes a
    // summarizable region: with the default window the whole transcript is
    // "recent", the planner reports nothing-to-compact, and the D9 gate is never
    // reached. The gate under test is the summary check, not the cut point.
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: true, reserveTokens: 1000, keepRecentTokens: 5 },
    }),
    modelRegistry: ModelRegistry.inMemory(authStorage),
  });
  // Mirror the persisted history into the live agent state so summarization has
  // a conversation to read.
  session.agent.state.messages = sessionManager
    .getEntries()
    .flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
  return { session, sessionManager };
}

describe("D9: degenerate compaction summary rejection", () => {
  beforeEach(() => {
    streamMocks.streamSimple.mockClear();
  });

  it.each([
    ["measured placeholder template", DEGENERATE_SUMMARY, "meta_instruction_echo"],
    ["meta-echo", MEASURED_META_ECHO, "meta_instruction_echo"],
  ])(
    "rejects a degenerate summary (%s) and preserves the original transcript",
    async (_label, summaryText, signal) => {
      streamMocks.streamSimple.mockReturnValue(streamReturning(summaryText));
      const { session, sessionManager } = await buildSessionWithHistory();

      const beforeEntries = sessionManager.getEntries();
      const beforeTypes = beforeEntries.map((e) => e.type);

      await expect(session.compact()).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof CompactionDegenerateError ||
          (err instanceof Error && err.message.includes("degenerate compaction summary")),
      );

      const afterEntries = sessionManager.getEntries();
      const afterTypes = afterEntries.map((e) => e.type);
      // No compaction entry was appended — the placeholder never entered the
      // transcript, so the original history is retained.
      expect(afterTypes.some((t) => t === "compaction")).toBe(false);
      expect(afterTypes).toEqual(beforeTypes);
      // The detector proves the summary qualified as degenerate.
      expect(detectDegenerateCompactionSummary(summaryText).signal).toBe(signal);
    },
  );

  it("adopts a healthy summary normally", async () => {
    streamMocks.streamSimple.mockReturnValue(streamReturning(REAL_SUMMARY));
    const { session, sessionManager } = await buildSessionWithHistory();

    const result = await session.compact();

    expect(result.summary).toContain("persist scheduler state");
    const types = sessionManager.getEntries().map((e) => e.type);
    expect(types.some((t) => t === "compaction")).toBe(true);
  });
});

const MEASURED_META_ECHO =
  "Please provide the conversation content between the user and the AI coding assistant. " +
  "Since the conversation was not included in your prompt, I cannot generate the summary.";
