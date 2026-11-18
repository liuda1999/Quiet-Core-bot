import { describe, expect, it } from "vitest";

import { parseBingHtml } from "./bing-html.js";

const ORGANIC_PAGE = `
<ol id="b_results">
  <li class="b_algo">
    <h2><a href="https://www.typescriptlang.org/docs/handbook/">TypeScript: Handbook</a></h2>
    <p class="b_lineclamp4">The TypeScript handbook explains the type system.</p>
  </li>
  <li class="b_algo b_ad">
    <h2><a href="https://ads.example.com/buy">Buy TypeScript courses</a></h2>
    <p class="b_lineclamp2">Sponsored.</p>
  </li>
  <li class="b_algo">
    <h2><a href="https://github.com/microsoft/TypeScript"><strong>TypeScript</strong> repo</a></h2>
    <p class="b_lineclamp2">TypeScript is a superset of JavaScript.</p>
  </li>
  <li class="b_algo">
    <h2><a href="https://www.bing.com/ck/a?redirect">Bing internal</a></h2>
  </li>
</ol>
`;

const NO_RESULTS_PAGE = `
<ol id="b_results">
  <li class="b_no"><div>There are no results for that query</div></li>
  <li class="b_algo b_ad">
    <h2><a href="https://ads.example.com/popular">Popular right now</a></h2>
    <p class="b_lineclamp2">Sponsored filler.</p>
  </li>
</ol>
`;

describe("parseBingHtml", () => {
  it("keeps organic results, skips ads and Bing-internal links", () => {
    const sources = parseBingHtml(ORGANIC_PAGE);

    expect(sources.map((entry) => entry.url)).toEqual([
      "https://www.typescriptlang.org/docs/handbook/",
      "https://github.com/microsoft/TypeScript",
    ]);
    expect(sources[0]?.snippet).toContain("type system");
    expect(sources[1]?.title).toBe("TypeScript repo");
  });

  it("returns nothing for a no-results page padded with ads", () => {
    expect(parseBingHtml(NO_RESULTS_PAGE)).toEqual([]);
  });
});
