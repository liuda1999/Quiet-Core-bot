// Irc API module exposes the plugin public contract.
export { createAccountStatusSink } from "quiet-core-bot/plugin-sdk/channel-outbound";
export { DEFAULT_ACCOUNT_ID } from "quiet-core-bot/plugin-sdk/account-id";
export type { ChannelPlugin } from "quiet-core-bot/plugin-sdk/channel-core";
export { PAIRING_APPROVED_MESSAGE } from "quiet-core-bot/plugin-sdk/channel-status";
export { buildBaseChannelStatusSummary } from "quiet-core-bot/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "quiet-core-bot/plugin-sdk/text-chunking";
