// Web tool default tests cover enablement for the vendored dsh-web-kit tools.
import { describe, expect, it } from "vitest";
import { createWebFetchTool, createWebSearchTool } from "./web-tools.js";

describe("web tools defaults", () => {
  it("enables web_fetch by default", () => {
    const tool = createWebFetchTool({ config: {}, sandboxed: false });
    expect(tool?.name).toBe("web_fetch");
    expect(tool?.label).toBe("Web Fetch");
  });

  it("disables web_fetch when explicitly disabled", () => {
    const tool = createWebFetchTool({
      config: { tools: { web: { fetch: { enabled: false } } } },
      sandboxed: false,
    });
    expect(tool).toBeNull();
  });

  it("enables web_search by default", () => {
    const tool = createWebSearchTool({ config: {}, sandboxed: false });
    expect(tool?.name).toBe("web_search");
    expect(tool?.label).toBe("Web Search");
  });

  it("disables web_search when explicitly disabled", () => {
    const tool = createWebSearchTool({
      config: { tools: { web: { search: { enabled: false } } } },
      sandboxed: false,
    });
    expect(tool).toBeNull();
  });
});
