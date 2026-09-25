// Guards the command-level update paths that do not apply to independent builds.
//
// This repository is a stripped-down, locally maintained distribution that does not
// participate in upstream Quiet Core bot releases, so the mutating update commands (`update`,
// `update repair`, `update finalize`, `update wizard`) are refused before any network call
// or config write. Read-only status (`quiet-core-bot update status`) stays available.
import { normalizeLowercaseStringOrEmpty } from "@openclaw/normalization-core/string-coerce";

/** Environment switch that restores the upstream update flow (`0`/`false`/`off`/`no`). */
export const INDEPENDENT_BUILD_ENV_KEY = "OPENCLAW_INDEPENDENT_BUILD";

const UPSTREAM_UPDATE_RESTORE_VALUES = new Set(["0", "false", "off", "no"]);

/** Error thrown when a mutating update command is attempted on an independent build. */
export class IndependentBuildUpdateError extends Error {
  readonly code = "OPENCLAW_INDEPENDENT_BUILD_UPDATE_DISABLED";

  constructor() {
    super(formatIndependentBuildUpdateMessage());
    this.name = "IndependentBuildUpdateError";
  }
}

/**
 * Independent builds refuse upstream updates unless explicitly opted out. An unset or
 * unrecognized value keeps the guard active; only the documented restore values disable it.
 */
export function isIndependentBuild(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[INDEPENDENT_BUILD_ENV_KEY];
  if (raw === undefined) {
    return true;
  }
  const normalized = normalizeLowercaseStringOrEmpty(raw.trim());
  if (normalized === "") {
    return true;
  }
  return !UPSTREAM_UPDATE_RESTORE_VALUES.has(normalized);
}

/** Operator-facing message shown when a mutating update command is refused. */
export function formatIndependentBuildUpdateMessage(): string {
  return [
    "This build does not participate in upstream Quiet Core bot updates.",
    "`quiet-core-bot update`, `quiet-core-bot update repair`, `quiet-core-bot update finalize`, and `quiet-core-bot update wizard` are disabled for this independent distribution.",
    "Read-only status is still available: `quiet-core-bot update status`.",
    `Set ${INDEPENDENT_BUILD_ENV_KEY}=0 to restore the upstream update commands.`,
  ].join("\n");
}

/** Throw when the current environment marks this build as an independent distribution. */
export function assertUpstreamUpdateAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (!isIndependentBuild(env)) {
    return;
  }
  throw new IndependentBuildUpdateError();
}
