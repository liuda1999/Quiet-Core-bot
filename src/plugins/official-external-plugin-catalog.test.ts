import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalProviderContractPluginIds,
  resolveOfficialExternalProviderPluginIds,
  resolveOfficialExternalProviderPluginIdsForEnv,
  resolveOfficialExternalWebProviderContractPluginIdsForEnv,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("lists the externalized channels and plugins checked into the catalog", () => {
    const ids = listOfficialExternalPluginCatalogEntries()
      .map((entry) => resolveOfficialExternalPluginId(entry))
      .filter((id): id is string => Boolean(id))
      .toSorted();

    expect(ids).toEqual([
      "acpx",
      "clickclack",
      "diagnostics-otel",
      "diagnostics-prometheus",
      "diffs",
      "diffs-language-pack",
      "firecrawl",
      "irc",
      "llama-cpp",
      "lobster",
      "matrix",
      "mattermost",
      "memory-lancedb",
      "nextcloud-talk",
      "nostr",
      "quiet-core-bot-plugin-yuanbao",
      "quiet-core-bot-weixin",
      "quiet-core-bot-zaloclawbot",
      "raft",
      "searxng",
      "signal",
      "synology-chat",
      "tlon",
      "tokenjuice",
      "wecom-quiet-core-bot-plugin",
    ]);
  });

  it("keeps install metadata on each checked-in catalog entry", () => {
    const expected: Array<[string, Record<string, unknown>]> = [
      [
        "acpx",
        { npmSpec: "@quiet-core/acpx", defaultChoice: "npm", minHostVersion: ">=2026.4.25" },
      ],
      [
        "diagnostics-otel",
        {
          clawhubSpec: "clawhub:@quiet-core/diagnostics-otel",
          npmSpec: "@quiet-core/diagnostics-otel",
          defaultChoice: "npm",
          minHostVersion: ">=2026.4.25",
        },
      ],
      [
        "diagnostics-prometheus",
        {
          clawhubSpec: "clawhub:@quiet-core/diagnostics-prometheus",
          npmSpec: "@quiet-core/diagnostics-prometheus",
          defaultChoice: "npm",
          minHostVersion: ">=2026.4.25",
        },
      ],
      [
        "diffs",
        { npmSpec: "@quiet-core/diffs", defaultChoice: "npm", minHostVersion: ">=2026.4.30" },
      ],
      [
        "diffs-language-pack",
        {
          clawhubSpec: "clawhub:@quiet-core/diffs-language-pack",
          npmSpec: "@quiet-core/diffs-language-pack",
          defaultChoice: "npm",
          minHostVersion: ">=2026.5.27",
        },
      ],
      [
        "firecrawl",
        {
          clawhubSpec: "clawhub:@quiet-core/firecrawl-plugin",
          npmSpec: "@quiet-core/firecrawl-plugin",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.8",
        },
      ],
      [
        "lobster",
        { npmSpec: "@quiet-core/lobster", defaultChoice: "npm", minHostVersion: ">=2026.4.25" },
      ],
      [
        "memory-lancedb",
        {
          npmSpec: "@quiet-core/memory-lancedb",
          defaultChoice: "npm",
          minHostVersion: ">=2026.5.31",
        },
      ],
      [
        "llama-cpp",
        {
          npmSpec: "@quiet-core/llama-cpp-provider",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.2",
        },
      ],
      [
        "searxng",
        {
          clawhubSpec: "clawhub:@quiet-core/searxng-plugin",
          npmSpec: "@quiet-core/searxng-plugin",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.9",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "tokenjuice",
        {
          clawhubSpec: "clawhub:@quiet-core/tokenjuice",
          npmSpec: "@quiet-core/tokenjuice",
          defaultChoice: "npm",
          minHostVersion: ">=2026.5.28",
        },
      ],
    ];

    for (const [id, install] of expected) {
      expect(resolveOfficialExternalPluginInstall(expectCatalogEntry(id))).toEqual(install);
    }
  });

  it("keeps checked-in channel install specs with their recovery flags", () => {
    const channels: Array<[string, Record<string, unknown>]> = [
      [
        "clickclack",
        {
          clawhubSpec: "clawhub:@quiet-core/clickclack",
          npmSpec: "@quiet-core/clickclack",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.9",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "irc",
        {
          clawhubSpec: "clawhub:@quiet-core/irc",
          npmSpec: "@quiet-core/irc",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.9",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "mattermost",
        {
          clawhubSpec: "clawhub:@quiet-core/mattermost",
          npmSpec: "@quiet-core/mattermost",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.9",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "signal",
        {
          clawhubSpec: "clawhub:@quiet-core/signal",
          npmSpec: "@quiet-core/signal",
          defaultChoice: "npm",
          minHostVersion: ">=2026.6.9",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "matrix",
        {
          clawhubSpec: "clawhub:@quiet-core/matrix",
          npmSpec: "@quiet-core/matrix",
          defaultChoice: "clawhub",
          minHostVersion: ">=2026.4.10",
          allowInvalidConfigRecovery: true,
        },
      ],
      [
        "nextcloud-talk",
        {
          npmSpec: "@quiet-core/nextcloud-talk",
          defaultChoice: "npm",
          minHostVersion: ">=2026.4.10",
        },
      ],
      [
        "nostr",
        { npmSpec: "@quiet-core/nostr", defaultChoice: "npm", minHostVersion: ">=2026.4.10" },
      ],
      ["raft", { npmSpec: "@quiet-core/raft", defaultChoice: "npm", minHostVersion: ">=2026.6.8" }],
      [
        "synology-chat",
        {
          npmSpec: "@quiet-core/synology-chat",
          defaultChoice: "npm",
          minHostVersion: ">=2026.4.10",
        },
      ],
      [
        "tlon",
        { npmSpec: "@quiet-core/tlon", defaultChoice: "npm", minHostVersion: ">=2026.4.10" },
      ],
    ];

    for (const [id, install] of channels) {
      expect(resolveOfficialExternalPluginInstall(expectCatalogEntry(id))).toEqual(install);
    }
  });

  it("resolves third-party channel lookup aliases to published plugin ids", () => {
    const wecomByChannel = expectCatalogEntry("wecom");
    const yuanbaoByChannel = expectCatalogEntry("yuanbao");

    expect(resolveOfficialExternalPluginId(wecomByChannel)).toBe("wecom-quiet-core-bot-plugin");
    expect(resolveOfficialExternalPluginInstall(wecomByChannel)?.npmSpec).toBe(
      "@wecom/wecom-quiet-core-bot-plugin@2026.5.7",
    );
    expect(resolveOfficialExternalPluginId(yuanbaoByChannel)).toBe("quiet-core-bot-plugin-yuanbao");
    expect(resolveOfficialExternalPluginInstall(yuanbaoByChannel)?.npmSpec).toBe(
      "quiet-core-bot-plugin-yuanbao@2.15.0",
    );
  });

  it("maps external web-fetch and search contracts to plugin owners", () => {
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "webFetchProviders",
        providerIds: new Set(["firecrawl"]),
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "speechProviders",
        providerIds: new Set(["gradium", "inworld"]),
      }),
    ).toEqual([]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "embeddingProviders",
        providerIds: new Set(["local"]),
      }),
    ).toEqual(["llama-cpp"]);
  });

  it("maps env-only web-fetch credentials to external plugin owners", () => {
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { FIRECRAWL_API_KEY: "firecrawl-key" },
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { EXA_API_KEY: "exa-key" },
      }),
    ).toEqual([]);
  });

  it("returns no provider plugin owners because the provider catalog is empty", () => {
    expect(
      resolveOfficialExternalProviderPluginIds({
        providerIds: new Set(["groq", "modelstudio"]),
      }),
    ).toEqual([]);
    expect(
      resolveOfficialExternalProviderPluginIdsForEnv({
        GROQ_API_KEY: "groq-key",
        MOONSHOT_API_KEY: "moonshot-key",
      }),
    ).toEqual([]);
    expect(resolveOfficialExternalProviderPluginIdsForEnv({ GROQ_API_KEY: " " })).toEqual([]);
  });

  it("returns undefined for catalog ids that are not checked in", () => {
    expect(getOfficialExternalPluginCatalogEntry("telegram")).toBeUndefined();
    expect(getOfficialExternalPluginCatalogEntry("brave")).toBeUndefined();
    expect(getOfficialExternalPluginCatalogEntry("")).toBeUndefined();
  });
});
