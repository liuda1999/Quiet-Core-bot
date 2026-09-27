// A6: `memorySearch.provider=none` must announce the FTS-only degradation instead of degrading silently.
import { describe, expect, it, vi } from "vitest";

const loggerWarn = vi.hoisted(() => vi.fn());

vi.mock("../logging/subsystem.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logging/subsystem.js")>();
  return {
    ...actual,
    createSubsystemLogger: (subsystem: string) => {
      const logger = actual.createSubsystemLogger(subsystem);
      if (subsystem === "plugins/memory-embedding-startup") {
        return { ...logger, warn: loggerWarn };
      }
      return logger;
    },
  };
});

import type { OpenClawConfig } from "../config/types.quiet-core-bot.js";

function providerNoneConfig(): OpenClawConfig {
  return {
    agents: { defaults: { memorySearch: { provider: "none" } } },
  } as OpenClawConfig;
}

async function loadModule() {
  // Module-level dedup state must start fresh for each scenario.
  vi.resetModules();
  return await import("./gateway-startup-plugin-ids.js");
}

describe("memory embedding startup providers", () => {
  it("warns that provider=none disables semantic search instead of returning silently", async () => {
    loggerWarn.mockClear();
    const { collectConfiguredMemoryEmbeddingStartupProviderOwners } = await loadModule();

    const owners = collectConfiguredMemoryEmbeddingStartupProviderOwners(providerNoneConfig());

    expect(owners).toEqual([]);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const message = String(loggerWarn.mock.calls[0]?.[0]);
    expect(message).toContain("provider=none");
    expect(message).toContain("semantic (vector) search is disabled");
    expect(message).toContain("FTS-only keyword matching");
  });

  it("warns once even when the startup plan is recomputed", async () => {
    loggerWarn.mockClear();
    const { collectConfiguredMemoryEmbeddingStartupProviderOwners } = await loadModule();

    collectConfiguredMemoryEmbeddingStartupProviderOwners(providerNoneConfig());
    collectConfiguredMemoryEmbeddingStartupProviderOwners(providerNoneConfig());

    expect(loggerWarn).toHaveBeenCalledTimes(1);
  });
});
