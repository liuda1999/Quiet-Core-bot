// web_search adapter tests: argument compatibility and error surfacing.
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as Array<{ queries: string[]; maxResults: number }>);
const failure = vi.hoisted(() => ({ message: "" }));

vi.mock("../../web-tools/kit-singleton.js", () => ({
  getWebKit: () => ({ web: {} }),
  disposeWebKit: async () => undefined,
}));

vi.mock("../../web-tools/tools/search.js", () => ({
  runSearchQueries: async (_web: unknown, queries: string[], maxResults: number) => {
    calls.push({ queries, maxResults });
    if (failure.message !== "") {
      throw new Error(failure.message);
    }
    return {
      sources: queries.map((query) => ({ url: `https://example.com/${query}` })),
      truncated: false,
    };
  },
  formatSearchOutput: () => "formatted search output",
}));

import { createWebSearchTool } from "./web-search.js";

function toolOrThrow() {
  const tool = createWebSearchTool({ config: {}, sandboxed: false });
  if (tool === null) {
    throw new Error("web_search was unexpectedly disabled");
  }
  return tool;
}

describe("createWebSearchTool", () => {
  it("accepts the deprecated single query form", async () => {
    calls.length = 0;
    await toolOrThrow().execute("call-1", { query: "alpha" });
    expect(calls).toEqual([{ queries: ["alpha"], maxResults: 8 }]);
  });

  it("merges, trims, de-duplicates, and caps queries", async () => {
    calls.length = 0;
    await toolOrThrow().execute("call-2", {
      queries: [" alpha ", "alpha", "", "beta", "gamma", "delta", "epsilon"],
    });
    expect(calls[0]?.queries).toEqual(["alpha", "beta", "gamma", "delta"]);
  });

  it("clamps count to the supported range", async () => {
    calls.length = 0;
    await toolOrThrow().execute("call-3", { queries: ["alpha"], count: 99 });
    expect(calls[0]?.maxResults).toBe(10);
  });

  it("rejects an empty query list with a routable code", async () => {
    await expect(toolOrThrow().execute("call-4", {})).rejects.toThrow(
      "web_search failed [WEB_INVALID_ARGS]",
    );
  });

  it("explains an empty site: result instead of throwing", async () => {
    failure.message =
      "all search providers failed (bing-html: Bing returned no results inside github.com for the remaining terms)";
    try {
      const result = await toolOrThrow().execute("call-site", {
        queries: ["site:github.com microsoft TypeScript"],
      });
      expect(result.content[0]?.text).toContain("No results matched inside github.com");
      expect(result.details).toEqual({ sources: [], truncated: false });
    } finally {
      failure.message = "";
    }
  });

  it("refuses to build a tool when disabled", () => {
    expect(
      createWebSearchTool({ config: { tools: { web: { search: { enabled: false } } } } }),
    ).toBeNull();
  });
});
