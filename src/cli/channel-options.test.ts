// Channel option tests cover channel command option parsing and config resolution.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testing, formatCliChannelOptions, resolveCliChannelOptions } from "./channel-options.js";
import { testing as startupMetadataTesting } from "./startup-metadata.js";

const readFileSyncMock = vi.hoisted(() => vi.fn());
const listBundledChannelCatalogEntriesMock = vi.hoisted(() => vi.fn(() => []));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const base = ("default" in actual ? actual.default : actual) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...base,
      readFileSync: readFileSyncMock,
    },
    readFileSync: readFileSyncMock,
  };
});

vi.mock("../channels/bundled-channel-catalog-read.js", () => ({
  listBundledChannelCatalogEntries: listBundledChannelCatalogEntriesMock,
}));

describe("resolveCliChannelOptions", () => {
  beforeEach(() => {
    testing.resetPrecomputedChannelOptionsForTests();
    startupMetadataTesting.clearStartupMetadataCache();
    vi.clearAllMocks();
    listBundledChannelCatalogEntriesMock.mockReturnValue([]);
  });

  afterEach(() => {
    testing.resetPrecomputedChannelOptionsForTests();
    delete process.env.QUIET_CORE_PLUGIN_CATALOG_PATHS;
  });

  it("uses precomputed startup metadata when available", () => {
    readFileSyncMock.mockReturnValue(
      JSON.stringify({ channelOptions: ["cached", "quietchat", "cached"] }),
    );

    expect(resolveCliChannelOptions()).toEqual(["cached", "quietchat"]);
    expect(formatCliChannelOptions(["all"])).toBe("all|cached|quietchat");
    expect(listBundledChannelCatalogEntriesMock).not.toHaveBeenCalled();
  });

  it("falls back to the live bundled catalog when metadata is missing", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    listBundledChannelCatalogEntriesMock.mockReturnValue([
      { id: "irc" },
      { id: "matrix" },
      { id: "irc" },
    ]);

    expect(resolveCliChannelOptions()).toEqual(["irc", "matrix"]);
    expect(formatCliChannelOptions()).toBe("irc|matrix");
    expect(formatCliChannelOptions(["all"])).toBe("all|irc|matrix");
  });

  it("falls back to the live bundled catalog when metadata is empty", () => {
    readFileSyncMock.mockReturnValue(JSON.stringify({ channelOptions: [] }));
    listBundledChannelCatalogEntriesMock.mockReturnValue([{ id: "irc" }]);

    expect(resolveCliChannelOptions()).toEqual(["irc"]);
  });

  it("keeps a safe fallback label when no channels can be resolved", () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    listBundledChannelCatalogEntriesMock.mockImplementation(() => {
      throw new Error("catalog unavailable");
    });

    expect(resolveCliChannelOptions()).toEqual([]);
    expect(formatCliChannelOptions()).toBe("channel");
    expect(formatCliChannelOptions(["all"])).toBe("all");
  });

  it("ignores external catalog env during CLI bootstrap", () => {
    process.env.QUIET_CORE_PLUGIN_CATALOG_PATHS = "/tmp/plugins-catalog.json";
    readFileSyncMock.mockReturnValue(JSON.stringify({ channelOptions: ["cached", "quietchat"] }));

    expect(resolveCliChannelOptions()).toEqual(["cached", "quietchat"]);
  });
});
