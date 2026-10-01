// A6: `provider=none` must announce the FTS-only degradation once instead of degrading silently.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryLoggerWarn = vi.hoisted(() => vi.fn());

vi.mock("quiet-core-bot/plugin-sdk/memory-core-host-engine-foundation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("quiet-core-bot/plugin-sdk/memory-core-host-engine-foundation")>();
  return {
    ...actual,
    createSubsystemLogger: (subsystem: string) => ({
      ...actual.createSubsystemLogger(subsystem),
      warn: memoryLoggerWarn,
    }),
  };
});

import type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/memory-core-host-engine-foundation";
import { closeAllMemorySearchManagers, getMemorySearchManager } from "./index.js";
import { resetFtsOnlyDegradationWarningForTest } from "./manager.js";

function ftsOnlyDecreaseWarnings(): string[] {
  return memoryLoggerWarn.mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.includes("[memory-embedding]"));
}

describe("memory fts-only degradation warning", () => {
  let workspaceDir = "";

  beforeEach(async () => {
    memoryLoggerWarn.mockClear();
    resetFtsOnlyDegradationWarningForTest();
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-memory-fts-only-"));
    vi.stubEnv("QUIET_CORE_STATE_DIR", path.join(workspaceDir, "state"));
    await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
  });

  afterEach(async () => {
    await closeAllMemorySearchManagers();
    vi.unstubAllEnvs();
    if (workspaceDir) {
      // Windows keeps the SQLite handle alive past close; a leftover temp dir must not fail the test.
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
      workspaceDir = "";
    }
  });

  function createFtsOnlyConfig(): QuietCoreConfig {
    return {
      memory: { backend: "builtin" },
      agents: {
        defaults: {
          workspace: workspaceDir,
          memorySearch: {
            provider: "none",
            store: { vector: { enabled: false } },
            sync: { watch: false, onSessionStart: false, onSearch: false },
            query: { minScore: 0, hybrid: { enabled: false } },
          },
        },
        list: [{ id: "main", default: true }],
      },
    } as QuietCoreConfig;
  }

  it("warns once when provider=none degrades memory search to FTS-only", async () => {
    const result = await getMemorySearchManager({ cfg: createFtsOnlyConfig(), agentId: "main" });
    expect(result.manager).toBeTruthy();

    const warnings = ftsOnlyDecreaseWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("provider=none");
    expect(warnings[0]).toContain("semantic (vector) search is disabled");
    expect(warnings[0]).toContain("FTS-only keyword matching");
  });

  it("does not repeat the warning for the same agent and provider", async () => {
    await getMemorySearchManager({ cfg: createFtsOnlyConfig(), agentId: "main" });
    await closeAllMemorySearchManagers();
    await getMemorySearchManager({ cfg: createFtsOnlyConfig(), agentId: "main" });

    expect(ftsOnlyDecreaseWarnings()).toHaveLength(1);
  });
});
