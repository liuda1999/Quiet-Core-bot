// Covers channel-configured checks from bootstrap and plugin metadata.
import { describe, expect, it, vi } from "vitest";
import { isChannelConfigured } from "./channel-configured.js";

vi.mock("../channels/plugins/bootstrap-registry.js", () => ({
  getBootstrapChannelPlugin: () => undefined,
}));

describe("isChannelConfigured", () => {
  // Skipped: this standalone build does not bundle the telegram channel plugin.
  it.skip("detects Telegram env configuration through the package metadata seam", () => {
    expect(isChannelConfigured({}, "telegram", { TELEGRAM_BOT_TOKEN: "token" })).toBe(true);
  });

  // Skipped: this standalone build does not bundle the discord channel plugin.
  it.skip("detects Discord env configuration through the package metadata seam", () => {
    expect(isChannelConfigured({}, "discord", { DISCORD_BOT_TOKEN: "token" })).toBe(true);
  });

  // Skipped: this standalone build does not bundle the slack channel plugin.
  it.skip("detects Slack env configuration through the package metadata seam", () => {
    expect(isChannelConfigured({}, "slack", { SLACK_BOT_TOKEN: "xoxb-test" })).toBe(true);
  });

  it("requires both IRC host and nick env vars through the package metadata seam", () => {
    expect(isChannelConfigured({}, "irc", { IRC_HOST: "irc.example.com" })).toBe(false);
    expect(
      isChannelConfigured({}, "irc", {
        IRC_HOST: "irc.example.com",
        IRC_NICK: "quiet-core-bot",
      }),
    ).toBe(true);
  });

  it("still falls back to generic config presence for channels without a custom hook", () => {
    expect(
      isChannelConfigured(
        {
          channels: {
            signal: {
              httpPort: 8080,
            },
          },
        },
        "signal",
        {},
      ),
    ).toBe(true);
  });

  it("treats explicit enabled channel config as configured state", () => {
    expect(
      isChannelConfigured(
        {
          channels: {
            "quiet-core-bot-weixin": {
              enabled: true,
            },
          },
        },
        "quiet-core-bot-weixin",
        {},
      ),
    ).toBe(true);
  });

  it("does not treat disabled channel config as configured state", () => {
    expect(
      isChannelConfigured(
        {
          channels: {
            "quiet-core-bot-weixin": {
              enabled: false,
            },
          },
        },
        "quiet-core-bot-weixin",
        {},
      ),
    ).toBe(false);
  });

  it("does not treat persisted Matrix credentials as configured channel state", () => {
    expect(
      isChannelConfigured({}, "matrix", { QUIET_CORE_STATE_DIR: "state-with-matrix-creds" }),
    ).toBe(false);
  });
});
