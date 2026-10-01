// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "quiet-core-bot/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "quiet-core-bot/plugin-sdk/channel-contract";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "quiet-core-bot/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  QuietCoreConfig,
} from "quiet-core-bot/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "quiet-core-bot/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "quiet-core-bot/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "quiet-core-bot/plugin-sdk/reply-payload";
export type { PluginRuntime } from "quiet-core-bot/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export type { SecretInput } from "quiet-core-bot/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "quiet-core-bot/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
