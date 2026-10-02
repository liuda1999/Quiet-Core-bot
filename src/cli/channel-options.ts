// CLI channel option formatter backed by generated startup metadata when available.
import { uniqueStrings } from "@quiet-core/normalization-core/string-normalization";
import { listBundledChannelCatalogEntries } from "../channels/bundled-channel-catalog-read.js";
import { readCliStartupMetadata } from "./startup-metadata.js";

function dedupe(values: string[]): string[] {
  return uniqueStrings(values.filter(Boolean));
}

let precomputedChannelOptions: string[] | null | undefined;
let liveChannelOptions: string[] | undefined;

function loadPrecomputedChannelOptions(): string[] | null {
  if (precomputedChannelOptions !== undefined) {
    return precomputedChannelOptions;
  }
  try {
    const parsed = readCliStartupMetadata(import.meta.url) as { channelOptions?: unknown } | null;
    if (parsed && Array.isArray(parsed.channelOptions)) {
      precomputedChannelOptions = dedupe(
        parsed.channelOptions.filter((value): value is string => typeof value === "string"),
      );
      return precomputedChannelOptions;
    }
  } catch {
    // Source checkouts may not have generated startup metadata yet.
  }
  precomputedChannelOptions = null;
  return null;
}

function loadLiveChannelOptions(): string[] {
  // Metadata can be missing or stale (source checkout before `pnpm build`); fall
  // back to the live bundled catalog so help never renders an empty channel enum.
  if (liveChannelOptions !== undefined) {
    return liveChannelOptions;
  }
  try {
    liveChannelOptions = dedupe(listBundledChannelCatalogEntries().map((entry) => entry.id));
  } catch {
    liveChannelOptions = [];
  }
  return liveChannelOptions;
}

export function resolveCliChannelOptions(): string[] {
  const precomputed = loadPrecomputedChannelOptions();
  if (precomputed && precomputed.length > 0) {
    return precomputed;
  }
  return loadLiveChannelOptions();
}

export function formatCliChannelOptions(extra: string[] = []): string {
  const options = [...extra, ...resolveCliChannelOptions()];
  return options.length > 0 ? options.join("|") : "channel";
}

export const testing = {
  resetPrecomputedChannelOptionsForTests(): void {
    precomputedChannelOptions = undefined;
    liveChannelOptions = undefined;
  },
};
export { testing as __testing };
