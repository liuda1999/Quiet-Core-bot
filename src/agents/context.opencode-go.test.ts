import { afterEach, describe, expect, it } from "vitest";
import { resolveMemoryFlushContextWindowTokens } from "../auto-reply/reply/memory-flush.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { refreshContextWindowCache, resetContextWindowCacheForTest } from "./context.js";

describe("OpenCode Go context metadata", () => {
  afterEach(() => {
    resetContextWindowCacheForTest();
  });

  it("warms the provider-owned context window without writing model config", async () => {
    const cfg: QuietCoreConfig = {};

    await refreshContextWindowCache(cfg);

    expect(
      resolveMemoryFlushContextWindowTokens({
        cfg,
        provider: "opencode-go",
        modelId: "deepseek-v4-pro",
      }),
    ).toBe(1_000_000);
    expect(cfg.models).toBeUndefined();
  });
});
