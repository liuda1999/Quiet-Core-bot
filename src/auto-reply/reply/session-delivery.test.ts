// Tests how session delivery preserves previous channel and target routing state.
import { describe, expect, it } from "vitest";
import { resolveLastChannelRaw, resolveLastToRaw } from "./session-delivery.js";

describe("inter-session lastRoute preservation (fixes #54441)", () => {
  it("inter-session message does NOT overwrite established Discord lastChannel", () => {
    expect(
      resolveLastChannelRaw({
        originatingChannelRaw: "webchat",
        persistedLastChannel: "signal",
        sessionKey: "agent:samantha:main",
        isInterSession: true,
      }),
    ).toBe("signal");
  });

  it("inter-session message does NOT overwrite established Telegram lastChannel", () => {
    expect(
      resolveLastChannelRaw({
        originatingChannelRaw: "webchat",
        persistedLastChannel: "matrix",
        sessionKey: "agent:main:matrix:direct:123456",
        isInterSession: true,
      }),
    ).toBe("matrix");
  });

  it("inter-session message does NOT overwrite established external lastTo", () => {
    expect(
      resolveLastToRaw({
        originatingChannelRaw: "webchat",
        originatingToRaw: "session:somekey",
        toRaw: "session:somekey",
        persistedLastTo: "channel:1234567890",
        persistedLastChannel: "signal",
        sessionKey: "agent:samantha:main",
        isInterSession: true,
      }),
    ).toBe("channel:1234567890");
  });

  it("regular Discord user message DOES update lastChannel normally", () => {
    expect(
      resolveLastChannelRaw({
        originatingChannelRaw: "signal",
        persistedLastChannel: "signal",
        sessionKey: "agent:main:signal:channel:123",
        isInterSession: false,
      }),
    ).toBe("signal");
  });

  it("inter-session on a NEW session (no persisted external route) may set webchat", () => {
    // When there is no established external route, inter-session should not
    // forcefully block the update — the session has no external route to protect.
    const result = resolveLastChannelRaw({
      originatingChannelRaw: "webchat",
      persistedLastChannel: undefined,
      sessionKey: "agent:samantha:main",
      isInterSession: true,
    });
    // No external route existed — falls through to normal resolution (webchat or undefined).
    expect(["webchat", undefined]).toContain(result);
  });

  it("inter-session on session with no persisted lastTo preserves session route", () => {
    const result = resolveLastToRaw({
      originatingChannelRaw: "webchat",
      originatingToRaw: "session:somekey",
      toRaw: "session:somekey",
      persistedLastTo: undefined,
      persistedLastChannel: undefined,
      sessionKey: "agent:samantha:main",
      isInterSession: true,
    });
    // No external route — falls through to normal resolution
    expect(["session:somekey", undefined]).toContain(result);
  });
});

describe("session delivery direct-session routing overrides", () => {
  it.each([
    "agent:main:direct:user-1",
    "agent:main:matrix:direct:123456",
    "agent:main:matrix:account-a:direct:123456",
    "agent:main:matrix:dm:123456",
    "agent:main:matrix:direct:123456:thread:99",
    "agent:main:matrix:account-a:direct:123456:topic:ops",
  ])(
    "preserves persisted external route when webchat accesses channel-peer session %s (fixes #47745)",
    (sessionKey) => {
      // Webchat/dashboard viewing an external-channel session must not overwrite
      // the delivery route — subagents must still deliver to the original channel.
      expect(
        resolveLastChannelRaw({
          originatingChannelRaw: "webchat",
          persistedLastChannel: "matrix",
          sessionKey,
        }),
      ).toBe("matrix");
      expect(
        resolveLastToRaw({
          originatingChannelRaw: "webchat",
          originatingToRaw: "session:dashboard",
          persistedLastChannel: "matrix",
          persistedLastTo: "123456",
          sessionKey,
        }),
      ).toBe("123456");
    },
  );

  it.each([
    "agent:main:main:direct",
    "agent:main:cron:job-1:dm",
    "agent:main:subagent:worker:direct:user-1",
    "agent:main:matrix:channel:direct",
    "agent:main:matrix:account-a:direct",
    "agent:main:matrix:direct:123456:cron:job-1",
  ])("keeps persisted external routes for malformed direct-like key %s", (sessionKey) => {
    expect(
      resolveLastChannelRaw({
        originatingChannelRaw: "webchat",
        persistedLastChannel: "matrix",
        sessionKey,
      }),
    ).toBe("matrix");
    expect(
      resolveLastToRaw({
        originatingChannelRaw: "webchat",
        originatingToRaw: "session:dashboard",
        persistedLastChannel: "matrix",
        persistedLastTo: "group:12345",
        sessionKey,
      }),
    ).toBe("group:12345");
  });
});
