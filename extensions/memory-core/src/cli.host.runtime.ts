// Memory Core plugin module implements cli.host behavior.
export {
  colorize,
  defaultRuntime,
  formatErrorMessage,
  isRich,
  resolveCommandSecretRefsViaGateway,
  setVerbose,
  shortenHomeInString,
  shortenHomePath,
  theme,
  withManager,
  withProgress,
  withProgressTotals,
} from "quiet-core-bot/plugin-sdk/memory-core-host-runtime-cli";
export {
  getRuntimeConfig,
  resolveDefaultAgentId,
  resolveSessionTranscriptsDirForAgent,
  resolveStateDir,
  type QuietCoreConfig,
} from "quiet-core-bot/plugin-sdk/memory-core-host-runtime-core";
export {
  listMemoryFiles,
  normalizeExtraMemoryPaths,
} from "quiet-core-bot/plugin-sdk/memory-core-host-runtime-files";
export { getMemorySearchManager } from "./memory/index.js";
