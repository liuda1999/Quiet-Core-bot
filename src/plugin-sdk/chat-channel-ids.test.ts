/**
 * Tests chat channel id normalization and matching helpers.
 */
import { describe, expect, it } from "vitest";
import { listBundledChannelCatalogEntries } from "../channels/bundled-channel-catalog-read.js";
import {
  BUNDLED_CHAT_CHANNEL_ENVELOPE_PREFIXES,
  BUNDLED_CHAT_CHANNEL_IDS,
} from "./chat-channel-ids.js";

describe("plugin-sdk chat-channel-ids", () => {
  it("covers every bundled and official channel catalog id", () => {
    const exported = new Set(BUNDLED_CHAT_CHANNEL_IDS);
    const missing = listBundledChannelCatalogEntries()
      .map((entry) => entry.id)
      .filter((id) => !exported.has(id));

    expect(missing).toEqual([]);
  });

  it("covers channel labels and aliases used by envelope formatters", () => {
    // The prefix list is built with case-insensitive de-duplication, so compare the same way.
    const normalizedPrefixes = new Set(
      BUNDLED_CHAT_CHANNEL_ENVELOPE_PREFIXES.map((prefix) => prefix.toLowerCase()),
    );
    const entries = listBundledChannelCatalogEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(normalizedPrefixes.has(entry.id.toLowerCase()), entry.id).toBe(true);
      if (entry.channel.label) {
        expect(normalizedPrefixes.has(entry.channel.label.toLowerCase()), entry.channel.label).toBe(
          true,
        );
      }
      for (const alias of entry.aliases) {
        expect(normalizedPrefixes.has(alias.toLowerCase()), alias).toBe(true);
      }
    }
  });
});
