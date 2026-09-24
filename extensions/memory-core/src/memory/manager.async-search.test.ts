// Memory Core tests cover manager.async search plugin behavior.
import { describe, expect, it, vi } from "vitest";
import { awaitPendingManagerWork, startAsyncSearchSync } from "./manager-async-state.js";
import { MemoryIndexManager } from "./manager.js";

type StubKeywordHit = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  textScore: number;
  snippet: string;
  source: "memory" | "sessions";
};

function createFtsOnlySearchStub(keywordResults: StubKeywordHit[]): MemoryIndexManager {
  const manager = Object.create(MemoryIndexManager.prototype) as MemoryIndexManager;
  Object.assign(manager as unknown as Record<string, unknown>, {
    providerRequirement: { mode: "fts-only", provider: "none" },
    hasIndexedContent: () => true,
    settings: {
      sync: { onSearch: false },
      query: {
        minScore: 0.35,
        maxResults: 5,
        hybrid: {
          enabled: false,
          candidateMultiplier: 2,
          temporalDecay: { enabled: false, halfLifeDays: 30 },
        },
      },
    },
    warmSession: vi.fn(),
    ensureProviderInitialized: vi.fn(async () => {}),
    assertRequiredProviderAvailable: vi.fn(),
    dirty: false,
    sessionsDirty: false,
    sync: vi.fn(async () => {}),
    provider: null,
    providerLifecycle: { mode: "fts-only", reason: "test" },
    refreshIndexIdentityDirty: () => ({ status: "valid" }),
    sources: new Set(["memory"]),
    fts: { enabled: true, available: true },
    searchKeywordWithFallback: vi.fn(async () => keywordResults),
    workspaceDir: "",
  });
  return manager;
}

function keywordHit(params: { score: number; textScore: number }): StubKeywordHit {
  return {
    id: "chunk-1",
    path: "MEMORY.md",
    startLine: 1,
    endLine: 1,
    score: params.score,
    textScore: params.textScore,
    snippet: "alpha note",
    source: "memory",
  };
}

describe("memory search async sync", () => {
  it("waits for dirty sync before querying", async () => {
    let releaseSync = () => {};
    const pendingSync = new Promise<void>((resolve) => {
      releaseSync = () => resolve();
    });
    const syncMock = vi.fn(async () => {
      return pendingSync;
    });
    const queryMock = vi.fn(async () => []);
    const manager = Object.create(MemoryIndexManager.prototype) as MemoryIndexManager;
    Object.assign(manager as unknown as Record<string, unknown>, {
      providerRequirement: { mode: "fts-only", provider: "none" },
      hasIndexedContent: () => true,
      settings: {
        sync: { onSearch: true },
        query: {
          minScore: 0,
          maxResults: 5,
          hybrid: {
            enabled: true,
            candidateMultiplier: 2,
            temporalDecay: { enabled: false, halfLifeDays: 30 },
          },
        },
      },
      warmSession: vi.fn(),
      ensureProviderInitialized: vi.fn(async () => {}),
      assertRequiredProviderAvailable: vi.fn(),
      dirty: true,
      sessionsDirty: false,
      sync: syncMock,
      provider: null,
      providerLifecycle: { mode: "fts-only", reason: "test" },
      refreshIndexIdentityDirty: () => ({ status: "valid" }),
      sources: new Set(["memory"]),
      fts: { enabled: true, available: true },
      searchKeywordWithFallback: queryMock,
      workspaceDir: "",
    });

    const searchPromise = manager.search("current memory");
    await vi.waitFor(() => expect(syncMock).toHaveBeenCalledWith({ reason: "search" }));
    expect(queryMock).not.toHaveBeenCalled();

    expect(syncMock).toHaveBeenCalledTimes(1);
    releaseSync();
    await searchPromise;
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("waits for in-flight search sync during close", async () => {
    let releaseSync = () => {};
    const pendingSync = new Promise<void>((resolve) => {
      releaseSync = () => resolve();
    });

    let closed = false;
    const closePromise = awaitPendingManagerWork({ pendingSync }).then(() => {
      closed = true;
    });

    await Promise.resolve();
    expect(closed).toBe(false);

    releaseSync();
    await closePromise;
  });

  it("skips background search sync when search-triggered sync is disabled", async () => {
    const syncMock = vi.fn(async () => {});
    await startAsyncSearchSync({
      enabled: false,
      dirty: true,
      sessionsDirty: false,
      sync: syncMock,
      onError: vi.fn(),
    });
    expect(syncMock).not.toHaveBeenCalled();
  });
});

describe("memory search minScore gating", () => {
  it("returns a threshold-clearing hit unmarked", async () => {
    const manager = createFtsOnlySearchStub([keywordHit({ score: 0.8, textScore: 0.8 })]);

    const results = await manager.search("alpha");

    expect(results).toHaveLength(1);
    expect(results[0]?.belowMinScore).toBeUndefined();
  });

  it("returns no results when the search channels are empty", async () => {
    const manager = createFtsOnlySearchStub([]);

    await expect(manager.search("alpha")).resolves.toEqual([]);
  });

  it("flags lexical hits whose diluted combined score stays below the threshold", async () => {
    const manager = createFtsOnlySearchStub([keywordHit({ score: 0.2, textScore: 0.8 })]);

    const results = await manager.search("alpha");

    expect(results).toHaveLength(1);
    expect(results[0]?.belowMinScore).toBe(true);
  });
});

type StubVectorHit = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: "memory" | "sessions";
};

function createVectorSearchStub(vectorResults: StubVectorHit[]): MemoryIndexManager {
  const manager = Object.create(MemoryIndexManager.prototype) as MemoryIndexManager;
  Object.assign(manager as unknown as Record<string, unknown>, {
    providerRequirement: { mode: "optional", provider: "ollama" },
    hasIndexedContent: () => true,
    settings: {
      sync: { onSearch: false },
      query: {
        minScore: 0.35,
        maxResults: 5,
        hybrid: {
          enabled: false,
          candidateMultiplier: 2,
          temporalDecay: { enabled: false, halfLifeDays: 30 },
        },
      },
    },
    warmSession: vi.fn(),
    ensureProviderInitialized: vi.fn(async () => {}),
    assertRequiredProviderAvailable: vi.fn(),
    dirty: false,
    sessionsDirty: false,
    sync: vi.fn(async () => {}),
    provider: { id: "ollama", model: "nomic-embed-text" },
    providerLifecycle: { mode: "active", providerId: "ollama" },
    providerInitialized: true,
    refreshIndexIdentityDirty: () => ({ status: "valid" }),
    sources: new Set(["memory"]),
    // FTS unavailable => vector-only path, which is where the floor and the
    // confidence band are applied directly to the combined score.
    fts: { enabled: false, available: false },
    searchKeywordWithFallback: vi.fn(async () => []),
    embedQueryWithRetry: vi.fn(async () => [1, 0, 0]),
    searchVector: vi.fn(async () => vectorResults),
    workspaceDir: "",
  });
  return manager;
}

function vectorHit(score: number): StubVectorHit {
  return {
    id: "chunk-1",
    path: "memory/marker.md",
    startLine: 1,
    endLine: 3,
    score,
    snippet: "marker",
    source: "memory",
  };
}

describe("memory search with an unusable embedding endpoint (I19)", () => {
  function createEmptyIndexStub(syncImpl: () => Promise<void>): MemoryIndexManager {
    const manager = Object.create(MemoryIndexManager.prototype) as MemoryIndexManager;
    Object.assign(manager as unknown as Record<string, unknown>, {
      providerRequirement: { mode: "optional", provider: "ollama" },
      hasIndexedContent: () => false,
      settings: {
        sync: { onSearch: false },
        query: {
          minScore: 0.35,
          maxResults: 5,
          hybrid: {
            enabled: true,
            candidateMultiplier: 2,
            temporalDecay: { enabled: false, halfLifeDays: 30 },
          },
        },
      },
      warmSession: vi.fn(),
      ensureProviderInitialized: vi.fn(async () => {}),
      assertRequiredProviderAvailable: vi.fn(),
      dirty: false,
      sessionsDirty: false,
      sync: vi.fn(syncImpl),
      provider: { id: "ollama", model: "nomic-embed-text" },
      providerLifecycle: { mode: "active", providerId: "ollama" },
      providerInitialized: true,
      refreshIndexIdentityDirty: () => ({ status: "valid" }),
      sources: new Set(["memory"]),
      fts: { enabled: true, available: true },
      searchKeywordWithFallback: vi.fn(async () => []),
      workspaceDir: "",
    });
    return manager;
  }

  it("reports an explicit error when the bootstrap sync could not embed anything", async () => {
    const manager = createEmptyIndexStub(async () => {
      throw new Error("memory embeddings batch timed out after 60s");
    });

    await expect(manager.search("alpha")).rejects.toThrow(
      /Memory search unavailable: the memory index is empty and the bootstrap sync failed/,
    );
  });

  it("still returns an empty result for a genuinely empty index", async () => {
    const manager = createEmptyIndexStub(async () => {});

    await expect(manager.search("alpha")).resolves.toEqual([]);
  });
});

describe("memory search A24 confidence band", () => {
  it("drops an unrelated nearest neighbour that only squeaks past the floor", async () => {
    // R8 sample: an unrelated query returned exactly 0.35099 against a 0.35 floor.
    const manager = createVectorSearchStub([vectorHit(0.35099)]);

    await expect(manager.search("unrelated")).resolves.toEqual([]);
  });

  it("keeps a confident hit well above the band", async () => {
    // R8 T5 sample: the real anchor hit scored 0.50451.
    const manager = createVectorSearchStub([vectorHit(0.50451)]);

    const results = await manager.search("anchor");

    expect(results).toHaveLength(1);
    expect(results[0]?.score).toBe(0.50451);
  });

  it("treats the configured floor as a lower bound only", async () => {
    // Score inside [floor, floor + band) is intentionally not a match yet.
    const manager = createVectorSearchStub([vectorHit(0.4)]);

    await expect(manager.search("anchor")).resolves.toEqual([]);
  });
});
