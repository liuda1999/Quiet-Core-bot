import { describe, expect, it } from "vitest";

import { filterByQueryRelevance, isCjkQuery, queryRelevanceTokens } from "./relevance.js";
import type { WebSearchSource } from "../types.js";

function source(url: string, title: string, snippet?: string): WebSearchSource {
  return { url, title, ...(snippet === undefined ? {} : { snippet }) };
}

describe("queryRelevanceTokens", () => {
  it("uses bigrams for CJK runs and drops single characters", () => {
    const tokens = queryRelevanceTokens("拉尼娜 冬季");

    expect(tokens).toContain("拉尼");
    expect(tokens).toContain("尼娜");
    expect(tokens).toContain("冬季");
    expect(tokens).not.toContain("拉");
  });

  it("drops search operators and bare host fragments", () => {
    const tokens = queryRelevanceTokens("site:github.com liuda1999");

    expect(tokens).toContain("github.com");
    expect(tokens).toContain("liuda1999");
    expect(tokens).not.toContain("site");
    expect(tokens).not.toContain("com");
  });
});

describe("filterByQueryRelevance", () => {
  it("keeps sources that share a meaningful token", () => {
    const kept = filterByQueryRelevance("TypeScript 5.9 release notes", [
      source("https://www.typescriptlang.org/docs/", "TypeScript 5.9 is out"),
      source("https://example.com/weather", "北京天气预报"),
    ]);

    expect(kept.map((entry) => entry.url)).toEqual(["https://www.typescriptlang.org/docs/"]);
  });

  it("drops Bing's popular-results filler that only matches a bare year", () => {
    const kept = filterByQueryRelevance("2026年11月 LPR 贷款市场报价利率", [
      source("https://baike.baidu.com/item/2026年", "2026年_百度百科", "2026年，公历平年"),
      source("https://www.chinamoney.com.cn/", "贷款市场报价利率（LPR）", "2026年10月20日 LPR 报价"),
    ]);

    expect(kept.map((entry) => entry.url)).toEqual(["https://www.chinamoney.com.cn/"]);
  });

  it("drops single-character CJK matches for multi-character queries", () => {
    const kept = filterByQueryRelevance("拉尼娜 冬季 影响", [
      source("https://baike.baidu.com/item/拉", "拉（汉语文字）_百度百科", "拉，汉语一级字"),
    ]);

    expect(kept).toHaveLength(0);
  });

  it("leaves results untouched when the query has no usable tokens", () => {
    const input = [source("https://example.com/", "Anything")];

    expect(filterByQueryRelevance("!!!", input)).toHaveLength(1);
  });
});

describe("isCjkQuery", () => {
  it("detects mostly-Chinese queries", () => {
    expect(isCjkQuery("拉尼娜 冬季 影响")).toBe(true);
    expect(isCjkQuery("typescript release notes")).toBe(false);
  });
});
