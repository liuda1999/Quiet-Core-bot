// Qa Lab runtime API tests cover lazy private QA channel loading and degradation.
import { describe, expect, it, vi } from "vitest";

// Simulate a default build where the private QA channel SDK entrypoint is absent.
vi.mock("quiet-core-bot/plugin-sdk/qa-channel", () => {
  throw new Error("Cannot find module 'dist/plugin-sdk/root-alias.cjs/qa-channel'");
});

describe("qa-lab runtime-api without the private QA channel build", () => {
  it("loads the module and keeps non qa-channel capabilities usable", async () => {
    const runtimeApi = await import("./runtime-api.js");

    expect(typeof runtimeApi.definePluginEntry).toBe("function");
    expect(typeof runtimeApi.defaultQaRuntimeModelForMode("mock-openai")).toBe("string");
  });

  it("degrades async qa-channel functions with an actionable error", async () => {
    const { getQaBusState, sendQaBusMessage } = await import("./runtime-api.js");

    await expect(getQaBusState("http://127.0.0.1:1")).rejects.toThrow(
      /QUIET_CORE_BUILD_PRIVATE_QA=1/,
    );
    await expect(
      sendQaBusMessage({
        baseUrl: "http://127.0.0.1:1",
        accountId: "default",
        to: "dm:main",
        text: "hello",
      }),
    ).rejects.toThrow(/QUIET_CORE_BUILD_PRIVATE_QA=1/);
  });

  it("degrades synchronous qa-channel helpers with an actionable error", async () => {
    const { buildQaTarget, parseQaTarget } = await import("./runtime-api.js");

    await expect(buildQaTarget({ chatType: "direct", conversationId: "main" })).rejects.toThrow(
      /QUIET_CORE_BUILD_PRIVATE_QA=1/,
    );
    await expect(parseQaTarget("dm:main")).rejects.toThrow(/QUIET_CORE_BUILD_PRIVATE_QA=1/);
  });

  it("degrades the qa-channel plugin object with an actionable error", async () => {
    const { qaChannelPlugin } = await import("./runtime-api.js");

    expect(() => qaChannelPlugin.config).toThrow(/QUIET_CORE_BUILD_PRIVATE_QA=1/);
  });
});
