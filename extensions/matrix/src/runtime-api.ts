// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "quiet-core-bot/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "quiet-core-bot/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "quiet-core-bot/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "quiet-core-bot/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "quiet-core-bot/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "quiet-core-bot/plugin-sdk/channel-inbound";
export { logInboundDrop } from "quiet-core-bot/plugin-sdk/channel-inbound";
export { logTypingFailure } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { resolveAckReaction } from "quiet-core-bot/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "quiet-core-bot/plugin-sdk/setup";
export type {
  QuietCoreConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "quiet-core-bot/plugin-sdk/config-contracts";
export type { GroupToolPolicyConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export type { WizardPrompter } from "quiet-core-bot/plugin-sdk/setup";
export type { SecretInput } from "quiet-core-bot/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "quiet-core-bot/plugin-sdk/setup";
export type { RuntimeEnv } from "quiet-core-bot/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "quiet-core-bot/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "quiet-core-bot/plugin-sdk/channel-inbound";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "quiet-core-bot/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "quiet-core-bot/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "quiet-core-bot/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { resolveAgentIdFromSessionKey } from "quiet-core-bot/plugin-sdk/routing";
export { chunkTextForOutbound } from "quiet-core-bot/plugin-sdk/text-chunking";
export { createChannelMessageReplyPipeline } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { loadOutboundMediaFromUrl } from "quiet-core-bot/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "quiet-core-bot/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "quiet-core-bot/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "quiet-core-bot/plugin-sdk/channel-targets";
export { buildTimeoutAbortSignal } from "./matrix/sdk/timeout-abort-signal.js";
export { formatZonedTimestamp } from "quiet-core-bot/plugin-sdk/time-runtime";
export type { PluginRuntime, RuntimeLogger } from "quiet-core-bot/plugin-sdk/plugin-runtime";
export type { ReplyPayload } from "quiet-core-bot/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from the Matrix API barrel.
// Re-exporting auth-precedence here makes TS source loaders define the export twice.
