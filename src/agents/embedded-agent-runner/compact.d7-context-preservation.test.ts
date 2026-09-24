// D7: before compaction truly executes, the context reached up to that point
// (messages / tool results) must not be lost. When compaction fails or times
// out, the full pre-limiting context must be preserved — the live session must
// not be left in a truncated (pre-compacted) state.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentSessionMock,
  loadCompactHooksHarness,
  resetCompactHooksHarnessMocks,
  resetCompactSessionStateMocks,
  resolveModelMock,
  sessionCompactImpl,
  sessionMessages,
} from "./compact.hooks.harness.js";

type CompactDirect = typeof import("./compact.js").compactEmbeddedAgentSessionDirect;

let compactEmbeddedAgentSessionDirect: CompactDirect;

function mockResolvedModel() {
  resolveModelMock.mockReset();
  resolveModelMock.mockReturnValue({
    model: { provider: "openai", api: "responses", id: "fake", input: [] },
    error: null,
    authStorage: { setRuntimeApiKey: vi.fn() },
    modelRegistry: {},
  });
}

describe("D7: pre-compaction context preservation on failure", () => {
  beforeAll(async () => {
    const loaded = await loadCompactHooksHarness();
    compactEmbeddedAgentSessionDirect = loaded.compactEmbeddedAgentSessionDirect;
  });

  beforeEach(() => {
    resetCompactHooksHarnessMocks();
    mockResolvedModel();
    sessionCompactImpl.mockReset();
    sessionCompactImpl.mockResolvedValue({
      summary: "summary",
      firstKeptEntryId: "entry-1",
      tokensBefore: 120,
      details: { ok: true },
    } as never);
    resetCompactSessionStateMocks();
  });

  it("returns a non-compacted failure and preserves the full context when compaction times out", async () => {
    sessionCompactImpl.mockRejectedValueOnce(new Error("Compaction timed out after 600000ms"));

    const result = await compactEmbeddedAgentSessionDirect({
      sessionId: "session-1",
      sessionKey: "agent:main:session-1",
      sessionFile: "/tmp/session.jsonl",
      workspaceDir: "/tmp",
      currentTokenCount: 130,
    });

    expect(result.ok).toBe(false);
    expect(result.compacted).toBe(false);
    expect(result.reason).toContain("timed out");

    // The live session must still hold the full validated context (nothing
    // truncated/dropped by the aborted compaction).
    const sessionRecord = (await createAgentSessionMock.mock.results[0]?.value) as {
      session: { agent: { state: { messages: unknown[] } } };
    };
    expect(sessionRecord.session.agent.state.messages.length).toBe(sessionMessages.length);
  });
});
