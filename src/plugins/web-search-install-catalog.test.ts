import { describe, expect, it } from "vitest";
import {
  resolveWebSearchInstallCatalogEntry,
  resolveWebSearchInstallCatalogEntries,
  resolveWebSearchInstallCatalogEntriesForEnv,
} from "./web-search-install-catalog.js";

describe("web-search install catalog", () => {
  it("keeps Firecrawl's credential-backed provider installable and auto-detected", () => {
    const entry = resolveWebSearchInstallCatalogEntry({
      providerId: "firecrawl",
      pluginId: "firecrawl",
    });

    expect(entry).toMatchObject({
      pluginId: "firecrawl",
      install: {
        clawhubSpec: "clawhub:@quiet-core/firecrawl-plugin",
        npmSpec: "@quiet-core/firecrawl-plugin",
      },
      provider: {
        id: "firecrawl",
        envVars: ["FIRECRAWL_API_KEY"],
        credentialPath: "plugins.entries.firecrawl.config.webSearch.apiKey",
      },
    });
    expect(entry?.provider.autoDetectOrder).toBe(60);
    expect(
      resolveWebSearchInstallCatalogEntries().some(
        (candidate) => candidate.provider.id === "firecrawl",
      ),
    ).toBe(true);
  });

  it("resolves credential-backed plugins for env-only auto-detection", () => {
    expect(
      resolveWebSearchInstallCatalogEntriesForEnv({
        FIRECRAWL_API_KEY: "firecrawl-key",
        SEARXNG_BASE_URL: "http://search.local",
      }).map((entry) => entry.pluginId),
    ).toEqual(["firecrawl", "searxng"]);
  });
});
