// Qa Lab bus state tests cover graceful degradation without the private QA protocol build.
import { describe, expect, it, vi } from "vitest";

// Simulate a default build where the private QA protocol SDK entrypoint is absent.
vi.mock("quiet-core-bot/plugin-sdk/qa-channel-protocol", () => {
  throw new Error("Cannot find module 'dist/plugin-sdk/root-alias.cjs/qa-channel-protocol'");
});

describe("qa-bus state without the private QA protocol build", () => {
  it("loads the module and keeps tool-call free messaging usable", async () => {
    const { createQaBusState } = await import("./bus-state.js");
    const state = createQaBusState();

    const message = state.addInboundMessage({
      conversation: { id: "alice", kind: "direct" },
      senderId: "alice",
      text: "hello",
    });

    expect(message.toolCalls).toBeUndefined();
    expect(state.getSnapshot().messages).toHaveLength(1);
  });

  it("degrades tool-call sanitization with an actionable error", async () => {
    const { createQaBusState } = await import("./bus-state.js");
    const state = createQaBusState();

    expect(() =>
      state.addOutboundMessage({
        to: "dm:alice",
        text: "used a tool",
        toolCalls: [{ name: "exec", arguments: { command: "pwd" } }],
      }),
    ).toThrow(/QUIET_CORE_BUILD_PRIVATE_QA=1/);
  });
});
