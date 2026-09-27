// Mattermost API module exposes the plugin public contract.
export { createAccountStatusSink } from "quiet-core-bot/plugin-sdk/channel-outbound";
export type { ChannelPlugin } from "quiet-core-bot/plugin-sdk/core";
export { DEFAULT_ACCOUNT_ID } from "quiet-core-bot/plugin-sdk/core";
export { chunkTextForOutbound } from "quiet-core-bot/plugin-sdk/text-chunking";
