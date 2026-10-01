// Defines markdown table config types used by rendering surfaces.
import type { MarkdownTableMode } from "./types.base.js";
import type { QuietCoreConfig } from "./types.quiet-core-bot.js";

/** Parameters for resolving markdown table rendering per config and channel. */
export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<QuietCoreConfig>;
  channel?: string | null;
  accountId?: string | null;
  supportsBlockTables?: boolean;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
