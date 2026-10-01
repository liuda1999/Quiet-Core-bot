// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "quiet-core-bot/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "quiet-core-bot/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "quiet-core-bot/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "quiet-core-bot/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "quiet-core-bot/plugin-sdk/channel-outbound";
export { formatLocationText, toLocationContext } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "quiet-core-bot/plugin-sdk/agent-media-payload";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { logTypingFailure } from "quiet-core-bot/plugin-sdk/channel-outbound";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "quiet-core-bot/plugin-sdk/channel-targets";
