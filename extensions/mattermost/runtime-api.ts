// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  QuietCoreConfig,
  QuietCorePluginApi,
  PluginRuntime,
} from "quiet-core-bot/plugin-sdk/core";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export type { ReplyPayload } from "quiet-core-bot/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "quiet-core-bot/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "quiet-core-bot/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "quiet-core-bot/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "quiet-core-bot/plugin-sdk/channel-status";
export { createAccountStatusSink } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "quiet-core-bot/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "quiet-core-bot/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "quiet-core-bot/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "quiet-core-bot/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "quiet-core-bot/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "quiet-core-bot/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { logTypingFailure } from "quiet-core-bot/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "quiet-core-bot/plugin-sdk/outbound-media";
export { rawDataToString } from "quiet-core-bot/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "quiet-core-bot/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "quiet-core-bot/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "quiet-core-bot/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "quiet-core-bot/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "quiet-core-bot/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "quiet-core-bot/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "quiet-core-bot/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "quiet-core-bot/plugin-sdk/media-runtime";
export { normalizeProviderId } from "quiet-core-bot/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
