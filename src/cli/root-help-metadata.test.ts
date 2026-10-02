// Root help metadata tests cover runtime banner commit restoration.
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveCommitHashMock = vi.hoisted(() => vi.fn<() => string | null>(() => "abc1234"));

vi.mock("../infra/git-commit.js", () => ({
  resolveCommitHash: resolveCommitHashMock,
}));

import { testing } from "./root-help-metadata.js";

describe("root help metadata banner commit", () => {
  beforeEach(() => {
    resolveCommitHashMock.mockReset().mockReturnValue("abc1234");
  });

  it("substitutes the baked placeholder with the runtime commit", () => {
    expect(
      testing.restoreBannerCommit(
        "Quiet Core bot 0.1.0 (__QUIET_CORE_BANNER_COMMIT__)\nUsage: quiet-core-bot\n",
      ),
    ).toBe("Quiet Core bot 0.1.0 (abc1234)\nUsage: quiet-core-bot\n");
  });

  it("falls back to unknown when no commit can be resolved", () => {
    resolveCommitHashMock.mockReturnValue(null);
    expect(testing.restoreBannerCommit("(__QUIET_CORE_BANNER_COMMIT__)")).toBe("(unknown)");
  });

  it("leaves help text without a placeholder untouched", () => {
    const text = "Usage: quiet-core-bot\n";
    expect(testing.restoreBannerCommit(text)).toBe(text);
    expect(resolveCommitHashMock).not.toHaveBeenCalled();
  });
});
