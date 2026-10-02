/** Shared config mutations used by interactive and non-interactive onboarding. */
import { setConfigValueAtPath } from "../config/config-paths.js";
import type { DmScope } from "../config/types.base.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import type { ToolProfileId } from "../config/types.tools.js";

/** Default DM scoping selected during local onboarding. */
const ONBOARDING_DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";
/** Default tool profile selected during local onboarding. */
const ONBOARDING_DEFAULT_TOOLS_PROFILE: ToolProfileId = "coding";

/** Applies local gateway/workspace defaults without overwriting explicit user defaults. */
export function applyLocalSetupWorkspaceConfig(
  baseConfig: QuietCoreConfig,
  workspaceDir: string,
): QuietCoreConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
    session: {
      ...baseConfig.session,
      dmScope: baseConfig.session?.dmScope ?? ONBOARDING_DEFAULT_DM_SCOPE,
    },
    tools: {
      ...baseConfig.tools,
      profile: baseConfig.tools?.profile ?? ONBOARDING_DEFAULT_TOOLS_PROFILE,
    },
  };
}

/** Auth choices whose backend can also serve memory embeddings. */
const ONBOARDING_EMBEDDING_AUTH_CHOICES = new Set(["ollama", "lmstudio"]);

/**
 * Pins memory search to FTS-only when the selected auth backend cannot serve
 * embeddings, so a fresh install can always search its workspace instead of
 * failing closed on a default provider that was never installed.
 */
export function applyMemorySearchDefaultsConfig(
  cfg: QuietCoreConfig,
  authChoice: string | undefined,
): QuietCoreConfig {
  const normalized = authChoice?.trim().toLowerCase();
  if (normalized && ONBOARDING_EMBEDDING_AUTH_CHOICES.has(normalized)) {
    return cfg;
  }
  const next = structuredClone(cfg);
  setConfigValueAtPath(
    next as Record<string, unknown>,
    ["agents", "defaults", "memorySearch", "provider"],
    "none",
  );
  return next;
}

/** Marks default agents to skip bootstrap file creation. */
export function applySkipBootstrapConfig(cfg: QuietCoreConfig): QuietCoreConfig {
  const next = structuredClone(cfg);
  setConfigValueAtPath(
    next as Record<string, unknown>,
    ["agents", "defaults", "skipBootstrap"],
    true,
  );
  return next;
}
