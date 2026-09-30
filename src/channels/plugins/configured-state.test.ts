// Configured state tests cover channel plugin configured-state detection and summaries.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  hasBundledChannelConfiguredState,
  listBundledChannelIdsWithConfiguredState,
} from "./configured-state.js";

const nodeRequire = createRequire(import.meta.url);

describe("bundled channel configured-state metadata", () => {
  it("lists the shipped metadata-first configured-state channels", () => {
    expect(listBundledChannelIdsWithConfiguredState()).toEqual(["irc"]);
  });

  it("resolves metadata-first env probes without full plugin loads", () => {
    expect(
      hasBundledChannelConfiguredState({
        channelId: "irc",
        cfg: {},
        env: { IRC_HOST: "irc.example.com", IRC_NICK: "quiet-core-bot" },
      }),
    ).toBe(true);
    expect(
      hasBundledChannelConfiguredState({
        channelId: "discord",
        cfg: {},
        env: { DISCORD_BOT_TOKEN: "token" },
      }),
    ).toBe(false);
  });

  it("uses declarative env metadata without a TypeScript source require hook", () => {
    const previousTsHook = nodeRequire.extensions[".ts"];
    delete nodeRequire.extensions[".ts"];
    try {
      expect(
        hasBundledChannelConfiguredState({
          channelId: "irc",
          cfg: {},
          env: { IRC_HOST: "irc.example.com", IRC_NICK: "quiet-core-bot" },
        }),
      ).toBe(true);
    } finally {
      if (previousTsHook) {
        nodeRequire.extensions[".ts"] = previousTsHook;
      }
    }
  });
});
