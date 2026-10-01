// Diffs API module exposes the plugin public contract.
export type { QuietCoreConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export {
  definePluginEntry,
  type AnyAgentTool,
  type QuietCorePluginApi,
  type QuietCorePluginConfigSchema,
  type QuietCorePluginToolContext,
  type PluginLogger,
} from "quiet-core-bot/plugin-sdk/plugin-entry";
export { resolvePreferredQuietCoreTmpDir } from "quiet-core-bot/plugin-sdk/temp-path";
