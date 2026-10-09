// Guards config writes that are disallowed in Nix-managed installs.
import { resolveIsNixMode } from "./paths.js";

/** Agent-first Nix install docs shown when runtime config writes are blocked. */
export const NIX_QUIET_CORE_AGENT_FIRST_URL =
  "https://github.com/liuda1999/nix-openclaw#quick-start";
/** Public Quiet Core bot Nix overview shown with immutable-config errors. */
export const QUIET_CORE_NIX_OVERVIEW_URL =
  "https://github.com/liuda1999/Quiet-Core-bot/blob/main/docs/install/nix.md";

/** Error thrown when a mutating config path is attempted while Nix owns config state. */
export class NixModeConfigMutationError extends Error {
  readonly code = "QUIET_CORE_NIX_MODE_CONFIG_IMMUTABLE";

  constructor(params: { configPath?: string } = {}) {
    super(formatNixModeConfigMutationMessage(params));
    this.name = "NixModeConfigMutationError";
  }
}

/** Build the operator-facing immutable-config message for Nix-managed installs. */
export function formatNixModeConfigMutationMessage(params: { configPath?: string } = {}): string {
  return [
    "Config is managed by Nix (`QUIET_CORE_NIX_MODE=1`), so Quiet Core bot treats quiet-core-bot.json as immutable.",
    "This usually means nix-openclaw, the first-party Nix distribution, or another Nix-managed package set this mode.",
    ...(params.configPath ? [`Config path: ${params.configPath}`] : []),
    "Do not run setup, onboarding, quiet-core-bot update, plugin install/update/uninstall/enable, doctor repair/token-generation, or config set against this file.",
    "Edit the Nix source for this install instead. For nix-openclaw, edit `programs.openclaw.config` or `instances.<name>.config`, then rebuild with Home Manager or NixOS.",
    `Agent-first Nix setup: ${NIX_QUIET_CORE_AGENT_FIRST_URL}`,
    `Quiet Core bot Nix overview: ${QUIET_CORE_NIX_OVERVIEW_URL}`,
  ].join("\n");
}

/** Throw when the current environment marks Quiet Core bot config as Nix-managed and immutable. */
export function assertConfigWriteAllowedInCurrentMode(
  params: {
    configPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  if (!resolveIsNixMode(params.env)) {
    return;
  }
  // In Nix mode, all writes must happen in the declarative source and then rebuild.
  throw new NixModeConfigMutationError({ configPath: params.configPath });
}
