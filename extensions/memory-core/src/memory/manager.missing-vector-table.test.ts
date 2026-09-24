// Memory Core tests cover syncing an index whose vec0 table is absent.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OpenClawConfig } from "openclaw/plugin-sdk/memory-core-host-engine-foundation";
import { loadSqliteVecExtension } from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import { resolveOpenClawAgentSqlitePath } from "openclaw/plugin-sdk/sqlite-runtime";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "./embedding.test-mocks.js";
import { closeAllMemorySearchManagers, getMemorySearchManager } from "./index.js";
import type { MemoryIndexManager } from "./manager.js";

describe("memory index without a vector table", () => {
  let fixtureRoot = "";
  let caseId = 0;
  let workspaceDir = "";
  let indexPath = "";
  let manager: MemoryIndexManager | null = null;

  beforeAll(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-mem-missing-vec-"));
  });

  beforeEach(async () => {
    workspaceDir = path.join(fixtureRoot, `case-${caseId++}`);
    await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
    await fs.writeFile(path.join(workspaceDir, "MEMORY.md"), "Alpha topic\n\nKeep this note.");
    vi.stubEnv("OPENCLAW_STATE_DIR", path.join(workspaceDir, "state"));
    indexPath = resolveOpenClawAgentSqlitePath({ agentId: "main" });
  });

  afterEach(async () => {
    if (manager) {
      await manager.close();
      manager = null;
    }
    await closeAllMemorySearchManagers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeAllMemorySearchManagers();
    if (fixtureRoot) {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  async function openManager(): Promise<MemoryIndexManager> {
    const cfg = {
      memory: { backend: "builtin" },
      agents: {
        defaults: {
          workspace: workspaceDir,
          memorySearch: {
            provider: "openai",
            model: "mock-embed",
            cache: { enabled: false },
            sync: { watch: false, onSessionStart: false, onSearch: false },
          },
        },
        list: [{ id: "main", default: true }],
      },
    } as OpenClawConfig;
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    if (!result.manager) {
      throw new Error(result.error ?? "manager missing");
    }
    manager = result.manager as unknown as MemoryIndexManager;
    return manager;
  }

  function hasVectorTable(): boolean {
    const db = new DatabaseSync(indexPath);
    try {
      return (
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'memory_index_chunks_vec'",
          )
          .get() !== undefined
      );
    } finally {
      db.close();
    }
  }

  function countChunksContaining(term: string): number {
    const db = new DatabaseSync(indexPath);
    try {
      const row = db
        .prepare(`SELECT COUNT(*) as c FROM memory_index_chunks WHERE text LIKE ?`)
        .get(`%${term}%`) as { c: number } | undefined;
      return row?.c ?? 0;
    } finally {
      db.close();
    }
  }

  // Simulates a state dir published by a vector-disabled build (or a partially
  // restored index): the vec0 table is gone while the extension still loads.
  async function dropVectorTable(): Promise<void> {
    const db = new DatabaseSync(indexPath, { allowExtension: true });
    try {
      const loaded = await loadSqliteVecExtension({ db });
      expect(loaded.ok, loaded.error).toBe(true);
      db.exec("DROP TABLE memory_index_chunks_vec");
    } finally {
      db.close();
    }
  }

  it("continues indexing without a raw SQL error when the vector table is missing", async () => {
    const first = await openManager();
    await first.sync({ force: true });
    expect(hasVectorTable()).toBe(true);
    await first.close();
    manager = null;
    await closeAllMemorySearchManagers();

    await dropVectorTable();
    expect(hasVectorTable()).toBe(false);

    const reopened = await openManager();
    // Initializing the provider first proves the incremental sync below is not
    // short-circuited by an index-identity mismatch.
    await reopened.probeEmbeddingAvailability();
    expect(reopened.status().custom?.indexIdentity).toEqual({ status: "valid" });
    await fs.writeFile(
      path.join(workspaceDir, "MEMORY.md"),
      "Beta refresh marker\n\nUpdated memory content.",
    );
    // A dirty (incremental) sync is the path that prunes vector rows.
    (reopened as unknown as { dirty: boolean }).dirty = true;

    await expect(reopened.sync()).resolves.toBeUndefined();

    expect(countChunksContaining("refresh marker")).toBeGreaterThan(0);
  });
});
