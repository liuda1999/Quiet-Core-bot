// Lobster API module exposes the plugin public contract.
export { definePluginEntry } from "quiet-core-bot/plugin-sdk/core";
export type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  OpenClawPluginToolFactory,
} from "quiet-core-bot/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "quiet-core-bot/plugin-sdk/windows-spawn";
