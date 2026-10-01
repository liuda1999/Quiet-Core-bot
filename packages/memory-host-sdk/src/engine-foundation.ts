// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/quiet-core-bot-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/quiet-core-bot-runtime-agent.js";
export { parseDurationMs } from "./host/quiet-core-bot-runtime-config.js";
export { loadConfig } from "./host/quiet-core-bot-runtime-config.js";
export { resolveStateDir } from "./host/quiet-core-bot-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/quiet-core-bot-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/quiet-core-bot-runtime-config.js";
export { root } from "./host/quiet-core-bot-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/quiet-core-bot-runtime-io.js";
export { detectMime } from "./host/quiet-core-bot-runtime-io.js";
export { resolveGlobalSingleton } from "./host/quiet-core-bot-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/quiet-core-bot-runtime-session.js";
export { splitShellArgs } from "./host/quiet-core-bot-runtime-io.js";
export { runTasksWithConcurrency } from "./host/quiet-core-bot-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/quiet-core-bot-runtime-io.js";
export type { QuietCoreConfig } from "./host/quiet-core-bot-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/quiet-core-bot-runtime-config.js";
export type { SecretInput } from "./host/quiet-core-bot-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/quiet-core-bot-runtime-config.js";
export type { MemorySearchConfig } from "./host/quiet-core-bot-runtime-config.js";
