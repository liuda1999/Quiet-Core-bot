// Private runtime barrel for the bundled Signal extension.
// Prefer narrower SDK subpaths plus local extension seams over the legacy signal barrel.

export type { ChannelMessageActionAdapter } from "quiet-core-bot/plugin-sdk/channel-contract";
export { buildChannelConfigSchema, SignalConfigSchema } from "../config-api.js";
export { PAIRING_APPROVED_MESSAGE } from "quiet-core-bot/plugin-sdk/channel-status";
import type { QuietCoreConfig as RuntimeQuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export type { RuntimeQuietCoreConfig as QuietCoreConfig };
export type { QuietCorePluginApi, PluginRuntime } from "quiet-core-bot/plugin-sdk/core";
export type { ChannelPlugin } from "quiet-core-bot/plugin-sdk/core";
export {
  DEFAULT_ACCOUNT_ID,
  applyAccountNameToChannelSection,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "quiet-core-bot/plugin-sdk/core";
export { resolveChannelMediaMaxBytes } from "quiet-core-bot/plugin-sdk/media-runtime";
export { formatCliCommand, formatDocsLink } from "quiet-core-bot/plugin-sdk/setup-tools";
export { chunkText } from "quiet-core-bot/plugin-sdk/reply-runtime";
export { detectBinary } from "quiet-core-bot/plugin-sdk/setup-tools";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "quiet-core-bot/plugin-sdk/runtime-group-policy";
export {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "quiet-core-bot/plugin-sdk/status-helpers";
export { normalizeE164 } from "quiet-core-bot/plugin-sdk/text-utility-runtime";
export { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./normalize.js";
export {
  listEnabledSignalAccounts,
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  resolveSignalAccount,
} from "./accounts.js";
export { monitorSignalProvider } from "./monitor.js";
export { installSignalCli } from "./install-signal-cli.js";
export { probeSignal } from "./probe.js";
export { resolveSignalReactionLevel } from "./reaction-level.js";
export { removeReactionSignal, sendReactionSignal } from "./send-reactions.js";
export { sendMessageSignal } from "./send.js";
export { signalMessageActions } from "./message-actions.js";
export type { ResolvedSignalAccount } from "./accounts.js";
export type { SignalAccountConfig } from "./account-types.js";
