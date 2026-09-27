// Diffs API module exposes the plugin public contract.
export type { OpenClawConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
export {
  definePluginEntry,
  type AnyAgentTool,
  type OpenClawPluginApi,
  type OpenClawPluginConfigSchema,
  type OpenClawPluginToolContext,
  type PluginLogger,
} from "quiet-core-bot/plugin-sdk/plugin-entry";
export { resolvePreferredOpenClawTmpDir } from "quiet-core-bot/plugin-sdk/temp-path";
