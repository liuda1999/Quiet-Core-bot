// Manual facade. Keep loader boundary explicit.
import { loadBundledPluginPublicSurfaceModuleSync } from "./facade-loader.js";

type FacadeModule = {
  CLAUDE_CLI_BACKEND_ID: string;
  isClaudeCliProvider: (providerId: string) => boolean;
};

const MISSING_PUBLIC_SURFACE_PREFIX = "Unable to resolve bundled plugin public surface ";
const CLAUDE_CLI_BACKEND_ID_FALLBACK = "claude-cli";

// The anthropic provider plugin is optional in trimmed builds. Resolving its facade
// eagerly used to throw while this module was imported, which aborted every command
// turn that pulled in the CLI runner; degrade to the built-in Claude CLI defaults.
function loadFacadeModule(): FacadeModule | null {
  try {
    return loadBundledPluginPublicSurfaceModuleSync<FacadeModule>({
      dirName: "anthropic",
      artifactBasename: "api.js",
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(MISSING_PUBLIC_SURFACE_PREFIX)) {
      return null;
    }
    throw error;
  }
}

/** Anthropic plugin backend id for Claude CLI provider detection. */
export const CLAUDE_CLI_BACKEND_ID: FacadeModule["CLAUDE_CLI_BACKEND_ID"] =
  loadFacadeModule()?.["CLAUDE_CLI_BACKEND_ID"] ?? CLAUDE_CLI_BACKEND_ID_FALLBACK;
/** Returns whether a provider id belongs to the Claude CLI backend family. */
export const isClaudeCliProvider: FacadeModule["isClaudeCliProvider"] = ((...args) =>
  loadFacadeModule()?.["isClaudeCliProvider"]?.(...args) ??
  false) as FacadeModule["isClaudeCliProvider"];
