// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/quiet-core-bot-runtime-agent.js";
export { resolveCronStyleNow } from "./host/quiet-core-bot-runtime-agent.js";
export { DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/quiet-core-bot-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/quiet-core-bot-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/quiet-core-bot-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/quiet-core-bot-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/quiet-core-bot-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/quiet-core-bot-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/quiet-core-bot-runtime-config.js";
export { resolveStateDir } from "./host/quiet-core-bot-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/quiet-core-bot-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/quiet-core-bot-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/quiet-core-bot-runtime-memory.js";
export { parseAgentSessionKey } from "./host/quiet-core-bot-runtime-agent.js";
export type { OpenClawConfig } from "./host/quiet-core-bot-runtime-config.js";
export type { MemoryCitationsMode } from "./host/quiet-core-bot-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/quiet-core-bot-runtime-memory.js";
export type { OpenClawPluginApi } from "./host/quiet-core-bot-runtime-memory.js";
