/**
 * Default agent workspace resolver.
 *
 * Derives the process workspace directory from env, profile, and home-directory state.
 */
import os from "node:os";
import path from "node:path";
import { normalizeOptionalLowercaseString } from "@quiet-core/normalization-core/string-coerce";
import { resolveStateDir } from "../config/paths.js";

/** Resolve the default agent workspace directory from env/profile/home state. */
export function resolveDefaultAgentWorkspaceDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const workspaceDir = env.QUIET_CORE_WORKSPACE_DIR?.trim();
  if (workspaceDir) {
    return path.resolve(workspaceDir);
  }
  // Anchor on the active state dir so a machine that still runs from the
  // pre-rebrand directory keeps its workspace instead of silently starting a
  // fresh one under the new name.
  const stateDir = resolveStateDir(env, homedir);
  const profile = env.QUIET_CORE_PROFILE?.trim();
  if (profile && normalizeOptionalLowercaseString(profile) !== "default") {
    return path.join(stateDir, `workspace-${profile}`);
  }
  return path.join(stateDir, "workspace");
}

/** Default agent workspace directory for the current process environment. */
export const DEFAULT_AGENT_WORKSPACE_DIR = resolveDefaultAgentWorkspaceDir();
