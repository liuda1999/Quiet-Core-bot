// Nostr API module exposes the plugin public contract.
export {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  type ChannelPlugin,
} from "quiet-core-bot/plugin-sdk/channel-plugin-common";
export type { ChannelOutboundAdapter } from "quiet-core-bot/plugin-sdk/channel-contract";
export {
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "quiet-core-bot/plugin-sdk/status-helpers";
