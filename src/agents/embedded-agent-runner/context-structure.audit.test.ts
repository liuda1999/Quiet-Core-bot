import {
  buildSessionContext,
  InMemorySessionStorage,
  prepareCompaction,
  Session,
} from "quiet-core-bot/plugin-sdk/agent-core";
import type { AgentMessage, SessionTreeEntry } from "quiet-core-bot/plugin-sdk/agent-core";
// Batch K1 · Task 1 — structured input/output audit.
//
// Audits the *shape* of the agent context transcript (structured input/output):
//   1. every persisted transcript entry has a legal `type` discriminator;
//   2. every assistant `toolCall` is paired one-to-one with a `toolResult`
//      (same count, same ids, same order);
//   3. structured fields (`toolCall.name/arguments`, `toolResult.status/exitCode`
//      /`details`) survive a serialize->deserialize round trip losslessly;
//   4. the same invariants still hold after a compaction entry exists.
//
// Deterministic: no provider/model is involved. The transcript is built through
// the real harness `Session` API and re-read through `buildSessionContext`.
import { describe, expect, it } from "vitest";

// The only entry discriminators the harness is allowed to persist into a
// transcript. Anything else is a structural corruption.
const LEGAL_ENTRY_TYPES = new Set<string>([
  "message",
  "thinking_level_change",
  "model_change",
  "compaction",
  "branch_summary",
  "custom",
  "custom_message",
  "label",
  "session_info",
  "leaf",
]);

function collectIllegalEntryTypes(entries: readonly { type?: unknown }[]): string[] {
  const illegal: string[] = [];
  for (const entry of entries) {
    if (typeof entry.type !== "string" || !LEGAL_ENTRY_TYPES.has(entry.type)) {
      illegal.push(typeof entry.type === "string" ? entry.type : String(entry.type));
    }
  }
  return illegal;
}

function usage() {
  return {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

type StructuredToolCall = { type: "toolCall"; id: string; name: string; arguments: unknown };

function assistantWithToolCalls(toolCalls: StructuredToolCall[], text?: string): AgentMessage {
  return {
    role: "assistant",
    content: [...(text ? [{ type: "text" as const, text }] : []), ...toolCalls],
    api: "responses",
    provider: "audit-provider",
    model: "audit-model",
    usage: usage(),
    stopReason: toolCalls.length > 0 ? "toolUse" : "stop",
    timestamp: 1,
  } as unknown as AgentMessage;
}

function toolResultMessage(params: {
  toolCallId: string;
  toolName: string;
  text: string;
  isError: boolean;
  details: unknown;
}): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    content: [{ type: "text", text: params.text }],
    isError: params.isError,
    details: params.details,
    timestamp: 2,
  } as unknown as AgentMessage;
}

type ToolPairing = {
  toolCallIds: string[];
  toolCallNames: string[];
  toolResultIds: string[];
  toolResultNames: string[];
};

/** Extracts toolCall/toolResult identifiers from a resolved model context. */
function extractToolPairing(messages: readonly AgentMessage[]): ToolPairing {
  const pairing: ToolPairing = {
    toolCallIds: [],
    toolCallNames: [],
    toolResultIds: [],
    toolResultNames: [],
  };
  for (const message of messages) {
    const record = message as unknown as { role?: string; content?: unknown };
    if (record.role === "assistant" && Array.isArray(record.content)) {
      for (const block of record.content) {
        const candidate = block as { type?: string; id?: string; name?: string };
        if (candidate.type === "toolCall") {
          pairing.toolCallIds.push(String(candidate.id));
          pairing.toolCallNames.push(String(candidate.name));
        }
      }
    } else if (record.role === "toolResult") {
      const result = message as unknown as { toolCallId?: string; toolName?: string };
      pairing.toolResultIds.push(String(result.toolCallId));
      pairing.toolResultNames.push(String(result.toolName));
    }
  }
  return pairing;
}

function expectToolCallsPaired(pairing: ToolPairing) {
  // One-to-one: identical counts.
  expect(pairing.toolResultIds.length).toBe(pairing.toolCallIds.length);
  // Same ids in the same order (no reordering / no id drift).
  expect(pairing.toolResultIds).toEqual(pairing.toolCallIds);
  // The tool name echoed on the result matches the requested call.
  expect(pairing.toolResultNames).toEqual(pairing.toolCallNames);
  // No orphan tool result: every result id must have a matching call.
  const callIds = new Set(pairing.toolCallIds);
  for (const id of pairing.toolResultIds) {
    expect(callIds.has(id)).toBe(true);
  }
}

/** Builds a transcript exercising messages, tool calls, tool results and markers. */
async function buildStructuredTranscript(): Promise<{
  session: Session;
  entries: SessionTreeEntry[];
}> {
  const session = new Session(new InMemorySessionStorage());
  await session.appendMessage({
    role: "user",
    content: "please run the audit tool",
    timestamp: 0,
  } as unknown as AgentMessage);
  await session.appendMessage(
    assistantWithToolCalls([
      {
        type: "toolCall",
        id: "call-1",
        name: "exec",
        arguments: { command: "echo KEYFACT-STRUCT-1", nested: { a: 1, b: [true, "x"] } },
      },
    ]),
  );
  await session.appendMessage(
    toolResultMessage({
      toolCallId: "call-1",
      toolName: "exec",
      text: "KEYFACT-STRUCT-1\n",
      isError: false,
      details: { status: 0, exitCode: 0 },
    }),
  );
  await session.appendMessage(
    assistantWithToolCalls([
      { type: "toolCall", id: "call-2", name: "read", arguments: { path: "/tmp/a.txt" } },
      { type: "toolCall", id: "call-3", name: "read", arguments: { path: "/tmp/b.txt" } },
    ]),
  );
  await session.appendMessage(
    toolResultMessage({
      toolCallId: "call-2",
      toolName: "read",
      text: "a",
      isError: true,
      details: { status: 1, exitCode: 2, stderr: "boom" },
    }),
  );
  await session.appendMessage(
    toolResultMessage({
      toolCallId: "call-3",
      toolName: "read",
      text: "b",
      isError: false,
      details: { status: 0, exitCode: 0 },
    }),
  );
  await session.appendThinkingLevelChange("high");
  await session.appendModelChange("audit-provider", "audit-model");
  await session.appendCustomEntry("audit-marker", { note: "keep" });
  await session.appendSessionName("structured transcript");
  const entries = await session.getEntries();
  return { session, entries };
}

describe("Task 1 · structured input/output audit", () => {
  it("only persists legal transcript entry types", async () => {
    const { entries } = await buildStructuredTranscript();
    const types = [...new Set(entries.map((entry) => entry.type))].sort();

    expect(collectIllegalEntryTypes(entries)).toEqual([]);
    expect(types).toEqual(
      ["custom", "message", "model_change", "session_info", "thinking_level_change"].sort(),
    );
    // Positive control: the validator can actually detect an illegal type.
    expect(collectIllegalEntryTypes([{ type: "bogus_entry" }])).toEqual(["bogus_entry"]);
  });

  it("pairs every assistant toolCall with a toolResult (count, id, order)", async () => {
    const { session } = await buildStructuredTranscript();
    const context = await session.buildContext();
    const pairing = extractToolPairing(context.messages);

    expect(pairing.toolCallIds).toEqual(["call-1", "call-2", "call-3"]);
    expectToolCallsPaired(pairing);
  });

  it("round-trips structured tool fields losslessly through JSON", async () => {
    const { entries } = await buildStructuredTranscript();

    // Serialize the whole transcript exactly like the JSONL store does, then
    // rebuild a session from the parsed rows and read the model context back.
    const serialized = entries.map((entry) => JSON.stringify(entry));
    const reparsed = serialized.map((line) => JSON.parse(line) as SessionTreeEntry);
    const reloaded = new Session(new InMemorySessionStorage({ entries: reparsed }));
    const context = await reloaded.buildContext();

    // The structure the model sees must be byte-identical to the source rows.
    expect(context.messages).toEqual(buildSessionContext(entries).messages);
    // And parsed rows must deep-equal the original entries (no field loss).
    expect(reparsed).toEqual(entries);

    const assistant = context.messages.find(
      (message) => (message as { role?: string }).role === "assistant",
    ) as unknown as { content: Array<Record<string, unknown>> };
    const firstCall = assistant.content.find((block) => block.type === "toolCall") as Record<
      string,
      unknown
    >;
    expect(firstCall.name).toBe("exec");
    expect(firstCall.arguments).toEqual({
      command: "echo KEYFACT-STRUCT-1",
      nested: { a: 1, b: [true, "x"] },
    });

    const errored = context.messages.find(
      (message) =>
        (message as { role?: string }).role === "toolResult" &&
        (message as { toolCallId?: string }).toolCallId === "call-2",
    ) as unknown as Record<string, unknown>;
    expect(errored.isError).toBe(true);
    expect(errored.details).toEqual({ status: 1, exitCode: 2, stderr: "boom" });
  });

  it("keeps pairing and field structure intact after a compaction entry", async () => {
    const { session, entries } = await buildStructuredTranscript();

    // A deterministic, provider-free compaction plan over this transcript.
    const preparation = prepareCompaction(entries, {
      enabled: true,
      reserveTokens: 1000,
      keepRecentTokens: 1,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok || !preparation.value) {
      throw new Error("expected a summarizable region for the structured fixture");
    }
    expect(preparation.value.firstKeptEntryId).toBeTypeOf("string");

    // Record a compaction exactly like the harness does. The summary keeps the
    // anchored fact so we also prove the entry survives round-trip.
    await session.appendCompaction(
      "COMPACTED summary KEYFACT-STRUCT-1",
      preparation.value.firstKeptEntryId,
      42,
      { readFiles: [], modifiedFiles: [] },
    );

    const after = await session.getEntries();
    const compaction = after.find((entry) => entry.type === "compaction");
    expect(compaction).toBeDefined();
    if (!compaction || compaction.type !== "compaction") {
      throw new Error("missing compaction entry");
    }
    expect(compaction.summary).toContain("KEYFACT-STRUCT-1");
    expect(compaction.firstKeptEntryId).toBe(preparation.value.firstKeptEntryId);
    expect(compaction.tokensBefore).toBe(42);

    // Still no illegal types and the compaction entry round-trips fully.
    expect(collectIllegalEntryTypes(after)).toEqual([]);
    expect(JSON.parse(JSON.stringify(compaction))).toEqual(compaction);

    // The post-compaction context must still pair: summarised turns are dropped
    // as a unit, so no orphan toolResult and no unpaired toolCall remains.
    const context = await session.buildContext();
    expect((context.messages[0] as { role?: string }).role).toBe("compactionSummary");
    const pairing = extractToolPairing(context.messages);
    expectToolCallsPaired(pairing);
  });
});
