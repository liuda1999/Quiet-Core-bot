// Irc tests cover monitor plugin behavior.
import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#quiet-core-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#quiet-core-bot",
      rawTarget: "#quiet-core-bot",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "quiet-core-bot-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "quiet-core-bot-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "quiet-core-bot-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "quiet-core-bot-bot",
      rawTarget: "quiet-core-bot-bot",
    });
  });
});
