import { describe, expect, it, vi } from "vitest";
import { createAssistantMessageEventStream } from "../../llm.js";
import type { AssistantMessage, Model, StreamFn } from "../../llm.js";
import type { AgentMessage } from "../../types.js";
import type { SessionTreeEntry } from "../types.js";
import { generateSummary, prepareCompaction } from "./compaction.js";

describe("generateSummary thinking options", () => {
  it("maps explicit Fable off to low effort for compaction", async () => {
    const model: Model = {
      id: "production-fable",
      name: "Production Fable",
      api: "anthropic-messages",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_000_000,
      maxTokens: 128_000,
      params: { canonicalModelId: "claude-fable-5" },
    };
    const summaryMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "summary" }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 1,
    };
    const streamFn = vi.fn<StreamFn>((_model, _context, options) => {
      expect(options?.reasoning).toBe("low");
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: summaryMessage });
      stream.end();
      return stream;
    });

    const result = await generateSummary(
      [{ role: "user", content: "hello", timestamp: 1 }],
      model,
      1000,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "off",
      streamFn,
    );

    expect(result).toEqual({ ok: true, value: "summary" });
    expect(streamFn).toHaveBeenCalledOnce();
  });
});

function messageEntry(id: string, message: AgentMessage): SessionTreeEntry {
  return { type: "message", id, parentId: null, timestamp: "2026-01-01T00:00:00.000Z", message };
}

function assistantMessage(text: string, timestamp: number): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "ollama",
    provider: "ollama",
    model: "local-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp,
  };
}

function testModel(): Model {
  return {
    id: "local-model",
    name: "Local Model",
    api: "ollama",
    provider: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 65536,
    maxTokens: 8192,
    params: { num_ctx: 65536 },
  };
}

describe("prepareCompaction summarizable-region guard", () => {
  it("reports nothing to compact when the whole transcript fits in keepRecentTokens", () => {
    // Regression: an all-recent transcript puts the cut point on the first entry,
    // so messagesToSummarize was empty and the summarization request went out with
    // an empty <conversation> block. The model then answered "please provide the
    // conversation" (measured on local Ollama) and the placeholder was rejected,
    // i.e. every boundary compaction burned a provider call and then failed.
    const entries: SessionTreeEntry[] = [
      messageEntry("e0", { role: "user", content: "hello", timestamp: 1 }),
      messageEntry("e1", assistantMessage("hi", 2)),
    ];

    const result = prepareCompaction(entries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 20_000,
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("keeps a real conversation in messagesToSummarize for a droppable region", () => {
    const entries: SessionTreeEntry[] = [
      messageEntry("e0", { role: "user", content: "FACT KEYFACT-TEST-A", timestamp: 1 }),
      messageEntry("e1", assistantMessage("ok", 2)),
      messageEntry("e2", { role: "user", content: "B".repeat(400), timestamp: 3 }),
    ];

    const result = prepareCompaction(entries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 40,
    });

    expect(result.ok).toBe(true);
    const preparation = result.ok ? result.value : undefined;
    expect(preparation).toBeDefined();
    expect(preparation?.messagesToSummarize).toHaveLength(2);
    expect(JSON.stringify(preparation?.messagesToSummarize)).toContain("KEYFACT-TEST-A");
  });

  it("issues a summarization request that carries the real conversation", async () => {
    const entries: SessionTreeEntry[] = [
      messageEntry("e0", { role: "user", content: "FACT KEYFACT-TEST-B", timestamp: 1 }),
      messageEntry("e1", assistantMessage("ok", 2)),
      messageEntry("e2", { role: "user", content: "B".repeat(400), timestamp: 3 }),
    ];
    const preparation = prepareCompaction(entries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 40,
    });
    if (!preparation.ok || !preparation.value) {
      throw new Error("expected a compaction preparation");
    }

    const model = testModel();
    const summaryMessage: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "summary" }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 1,
    };
    let capturedPrompt = "";
    const streamFn = vi.fn<StreamFn>((_model, context) => {
      capturedPrompt = context.messages
        .map((message) => {
          if (typeof message.content === "string") {
            return message.content;
          }
          return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
        })
        .join("\n");
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "done", reason: "stop", message: summaryMessage });
      stream.end();
      return stream;
    });

    await generateSummary(
      preparation.value.messagesToSummarize,
      model,
      1000,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      streamFn,
    );

    // The prompt must contain the real conversation, never an empty block.
    expect(capturedPrompt).toContain("<conversation>");
    expect(capturedPrompt).toContain("KEYFACT-TEST-B");
    expect(capturedPrompt).not.toMatch(/<conversation>\s*<\/conversation>/);
  });
});
