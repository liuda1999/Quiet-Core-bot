// Mattermost tests cover group mentions plugin behavior.
import { describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../runtime-api.js";
import { resolveMattermostGroupRequireMention } from "./group-mentions.js";

describe("resolveMattermostGroupRequireMention", () => {
  it("defaults to requiring mention when no override is configured", () => {
    const cfg: QuietCoreConfig = {
      channels: {
        mattermost: {},
      },
    };

    const requireMention = resolveMattermostGroupRequireMention({ cfg, accountId: "default" });
    expect(requireMention).toBe(true);
  });

  it("respects chatmode-derived account override", () => {
    const cfg: QuietCoreConfig = {
      channels: {
        mattermost: {
          chatmode: "onmessage",
        },
      },
    };

    const requireMention = resolveMattermostGroupRequireMention({ cfg, accountId: "default" });
    expect(requireMention).toBe(false);
  });

  it("prefers an explicit runtime override when provided", () => {
    const cfg: QuietCoreConfig = {
      channels: {
        mattermost: {
          chatmode: "oncall",
        },
      },
    };

    const requireMention = resolveMattermostGroupRequireMention({
      cfg,
      accountId: "default",
      requireMentionOverride: false,
    });
    expect(requireMention).toBe(false);
  });
});
