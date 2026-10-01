// Covers plugin discovery threading and concurrency behavior.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginDiscoveryResult } from "./discovery.js";

const discoverQuietCorePluginsMock = vi.fn();

vi.mock("./discovery.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./discovery.js")>();
  return {
    ...actual,
    discoverQuietCorePlugins: (...args: unknown[]) => discoverQuietCorePluginsMock(...args),
  };
});

const { loadPluginManifestRegistry } = await import("./manifest-registry.js");
const { resolveInstalledPluginIndexRegistry } =
  await import("./installed-plugin-index-registry.js");

const emptyDiscovery: PluginDiscoveryResult = { candidates: [], diagnostics: [] };

describe("discovery threading", () => {
  beforeEach(() => {
    discoverQuietCorePluginsMock.mockReset();
    discoverQuietCorePluginsMock.mockReturnValue(emptyDiscovery);
  });

  it("skips internal discoverQuietCorePlugins when discovery is supplied", () => {
    loadPluginManifestRegistry({ discovery: emptyDiscovery });
    expect(discoverQuietCorePluginsMock).not.toHaveBeenCalled();

    discoverQuietCorePluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({ discovery: emptyDiscovery, installRecords: {} });
    expect(discoverQuietCorePluginsMock).not.toHaveBeenCalled();
  });

  it("calls discoverQuietCorePlugins when neither discovery nor candidates supplied", () => {
    loadPluginManifestRegistry({});
    expect(discoverQuietCorePluginsMock).toHaveBeenCalledTimes(1);

    discoverQuietCorePluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({ installRecords: {} });
    expect(discoverQuietCorePluginsMock).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit candidates over discovery when both are supplied", () => {
    loadPluginManifestRegistry({ candidates: [], diagnostics: [], discovery: emptyDiscovery });
    expect(discoverQuietCorePluginsMock).not.toHaveBeenCalled();

    discoverQuietCorePluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({
      candidates: [],
      discovery: emptyDiscovery,
      installRecords: {},
    });
    expect(discoverQuietCorePluginsMock).not.toHaveBeenCalled();
  });
});
