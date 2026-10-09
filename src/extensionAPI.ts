/**
 * @deprecated Legacy compat surface for plugins that still import
 * quiet-core-bot/extension-api. Use the injected plugin runtime or focused
 * quiet-core-bot/plugin-sdk subpaths instead.
 */

const shouldWarnExtensionApiImport =
  process.env.VITEST !== "true" &&
  process.env.NODE_ENV !== "test" &&
  process.env.QUIET_CORE_SUPPRESS_EXTENSION_API_WARNING !== "1";

if (shouldWarnExtensionApiImport) {
  process.emitWarning(
    "quiet-core-bot/extension-api is deprecated. Migrate to api.runtime.agent.* or focused quiet-core-bot/plugin-sdk/<subpath> imports. See https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/plugins/sdk-migration.md",
    {
      code: "QUIET_CORE_EXTENSION_API_DEPRECATED",
      detail:
        "This compatibility bridge is temporary. Bundled plugins should use the injected plugin runtime instead of importing host-side agent helpers directly. Migration guide: https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/plugins/sdk-migration.md",
    },
  );
}

export { resolveAgentDir, resolveAgentWorkspaceDir } from "./agents/agent-scope.js";
export { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./agents/defaults.js";
export { resolveAgentIdentity } from "./agents/identity.js";
export { resolveThinkingDefault } from "./agents/model-selection.js";
export {
  runEmbeddedAgent,
  /** @deprecated Use runEmbeddedAgent. */
  runEmbeddedAgent as runEmbeddedPiAgent,
} from "./agents/embedded-agent.js";
export { resolveAgentTimeoutMs } from "./agents/timeout.js";
export { ensureAgentWorkspace } from "./agents/workspace.js";
export {
  resolveStorePath,
  loadSessionStore,
  saveSessionStore,
  updateSessionStore,
  updateSessionStoreEntry,
  resolveSessionFilePath,
} from "./config/sessions.js";
