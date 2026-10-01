// Model provider index catalog tests cover model list catalog indexing and provider grouping.
import { describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../../config/types.quiet-core-bot.js";
import { loadProviderIndexCatalogRowsForList } from "./list.provider-index-catalog.js";

const baseConfig = {} satisfies QuietCoreConfig;

describe("loadProviderIndexCatalogRowsForList", () => {
  it("returns no preview rows while the bundled provider index is empty", () => {
    expect(
      loadProviderIndexCatalogRowsForList({
        cfg: baseConfig,
        providerFilter: "moonshot",
      }),
    ).toEqual([]);
    expect(loadProviderIndexCatalogRowsForList({ cfg: baseConfig })).toEqual([]);
  });

  it("suppresses provider-index preview rows when the provider plugin is disabled", () => {
    expect(
      loadProviderIndexCatalogRowsForList({
        cfg: {
          plugins: {
            entries: {
              moonshot: { enabled: false },
            },
          },
        },
        providerFilter: "moonshot",
      }),
    ).toStrictEqual([]);
  });
});
