// Verifies provider capability contracts for media-generation runtimes.
import { describe, expect, it } from "vitest";
import { BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS } from "../plugins/contracts/inventory/bundled-capability-metadata.js";

const EXPECTED_BUNDLED_VIDEO_PROVIDER_PLUGIN_IDS = ["comfy"] as const;

const EXPECTED_BUNDLED_MUSIC_PROVIDER_PLUGIN_IDS = ["comfy"] as const;

const EXPECTED_BUNDLED_VIDEO_PROVIDER_IDS_BY_PLUGIN: Record<string, readonly string[]> = {};

const EXPECTED_BUNDLED_MUSIC_PROVIDER_IDS_BY_PLUGIN: Record<string, readonly string[]> = {};

function bundledVideoProviderPluginIds(): string[] {
  return BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter(
    (entry) => entry.videoGenerationProviderIds.length > 0,
  )
    .map((entry) => entry.pluginId)
    .toSorted((left, right) => left.localeCompare(right));
}

function bundledMusicProviderPluginIds(): string[] {
  return BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter(
    (entry) => entry.musicGenerationProviderIds.length > 0,
  )
    .map((entry) => entry.pluginId)
    .toSorted((left, right) => left.localeCompare(right));
}

describe("bundled media-generation provider capabilities", () => {
  it("tracks every bundled video-generation provider manifest", () => {
    expect(bundledVideoProviderPluginIds()).toEqual(EXPECTED_BUNDLED_VIDEO_PROVIDER_PLUGIN_IDS);
    for (const entry of BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter(
      (snapshot) => snapshot.videoGenerationProviderIds.length > 0,
    )) {
      expect(entry.videoGenerationProviderIds, entry.pluginId).toEqual(
        EXPECTED_BUNDLED_VIDEO_PROVIDER_IDS_BY_PLUGIN[entry.pluginId] ?? [entry.pluginId],
      );
    }
  });

  it("tracks every bundled music-generation provider manifest", () => {
    expect(bundledMusicProviderPluginIds()).toEqual(EXPECTED_BUNDLED_MUSIC_PROVIDER_PLUGIN_IDS);
    for (const entry of BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter(
      (snapshot) => snapshot.musicGenerationProviderIds.length > 0,
    )) {
      expect(entry.musicGenerationProviderIds, entry.pluginId).toEqual(
        EXPECTED_BUNDLED_MUSIC_PROVIDER_IDS_BY_PLUGIN[entry.pluginId] ?? [entry.pluginId],
      );
    }
  });
});
