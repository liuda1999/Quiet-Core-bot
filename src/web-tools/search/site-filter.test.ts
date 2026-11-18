import { describe, expect, it } from "vitest";

import { applySiteFilters, biasedQuery, parseSiteQuery } from "./site-filter.js";

describe("parseSiteQuery", () => {
  it("strips the operator and keeps the remaining terms", () => {
    const parsed = parseSiteQuery("site:github.com microsoft TypeScript");

    expect(parsed.filters).toEqual([{ host: "github.com" }]);
    expect(parsed.rest).toBe("microsoft TypeScript");
  });

  it("accepts a path prefix and ignores the scheme", () => {
    const parsed = parseSiteQuery("site:https://example.com/docs hooks");

    expect(parsed.filters).toEqual([{ host: "example.com", pathPrefix: "/docs" }]);
    expect(parsed.rest).toBe("hooks");
  });

  it("returns no filters for a plain query", () => {
    const parsed = parseSiteQuery("typescript generics");

    expect(parsed.filters).toEqual([]);
    expect(parsed.rest).toBe("typescript generics");
  });
});

describe("applySiteFilters", () => {
  const sources = [
    { url: "https://zhuanlan.zhihu.com/p/1" },
    { url: "https://www.zhihu.com/question/2" },
    { url: "https://example.com/p/3" },
  ];

  it("keeps subdomains of the requested host only", () => {
    const kept = applySiteFilters(sources, [{ host: "zhihu.com" }]);

    expect(kept.map((entry) => entry.url)).toEqual([
      "https://zhuanlan.zhihu.com/p/1",
      "https://www.zhihu.com/question/2",
    ]);
  });

  it("honors a path prefix", () => {
    const kept = applySiteFilters(
      [
        { url: "https://example.com/docs/hooks" },
        { url: "https://example.com/blog/hooks" },
      ],
      [{ host: "example.com", pathPrefix: "/docs" }],
    );

    expect(kept.map((entry) => entry.url)).toEqual(["https://example.com/docs/hooks"]);
  });

  it("does not treat a lookalike host as a match", () => {
    const kept = applySiteFilters([{ url: "https://notzhihu.com/p/1" }], [{ host: "zhihu.com" }]);

    expect(kept).toEqual([]);
  });
});

describe("biasedQuery", () => {
  it("appends the host so upstream ranking favors the site", () => {
    expect(biasedQuery("typescript generics", [{ host: "github.com" }])).toBe(
      "typescript generics github.com",
    );
  });

  it("uses only the host when the query had nothing else", () => {
    expect(biasedQuery("", [{ host: "github.com" }])).toBe("github.com");
  });
});
