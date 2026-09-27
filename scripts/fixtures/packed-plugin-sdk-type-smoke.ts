// Packed Plugin Sdk Type Smoke script supports OpenClaw repository automation.
type PublicPluginSdkModules = [
  typeof import("quiet-core-bot/plugin-sdk"),
  typeof import("quiet-core-bot/plugin-sdk/channel-entry-contract"),
  typeof import("quiet-core-bot/plugin-sdk/config-contracts"),
  typeof import("quiet-core-bot/plugin-sdk/provider-entry"),
  typeof import("quiet-core-bot/plugin-sdk/runtime-env"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;

void resolvedModules;
