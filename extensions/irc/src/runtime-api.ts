// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "quiet-core-bot/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "quiet-core-bot/plugin-sdk/channel-core";
export type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export type { PluginRuntime } from "quiet-core-bot/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "quiet-core-bot/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "quiet-core-bot/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "quiet-core-bot/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "quiet-core-bot/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "quiet-core-bot/plugin-sdk/channel-status";
export { createChannelPairingController } from "quiet-core-bot/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "quiet-core-bot/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "quiet-core-bot/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "quiet-core-bot/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "quiet-core-bot/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
