// Mattermost API module exposes the plugin public contract.
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChatType,
  HistoryEntry,
  QuietCoreConfig,
  QuietCorePluginApi,
  ReplyPayload,
} from "quiet-core-bot/plugin-sdk/core";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export { buildAgentMediaPayload } from "quiet-core-bot/plugin-sdk/agent-media-payload";
export { resolveAllowlistMatchSimple } from "quiet-core-bot/plugin-sdk/allow-from";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "quiet-core-bot/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { logTypingFailure } from "quiet-core-bot/plugin-sdk/channel-feedback";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
} from "quiet-core-bot/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "quiet-core-bot/plugin-sdk/models-provider-runtime";
export { isDangerousNameMatchingEnabled } from "quiet-core-bot/plugin-sdk/dangerous-name-runtime";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export { resolveChannelMediaMaxBytes } from "quiet-core-bot/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "quiet-core-bot/plugin-sdk/outbound-media";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildInboundHistoryFromMap,
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
} from "quiet-core-bot/plugin-sdk/reply-history";
export { registerPluginHttpRoute } from "quiet-core-bot/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "quiet-core-bot/plugin-sdk/webhook-ingress";
export {
  isTrustedProxyAddress,
  parseStrictPositiveInteger,
  resolveClientIp,
} from "quiet-core-bot/plugin-sdk/core";
export { parseTcpPort } from "quiet-core-bot/plugin-sdk/number-runtime";
