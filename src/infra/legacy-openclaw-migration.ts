// Legacy OpenClaw artifacts are recognized and renamed on first use so installs created
// before the quiet-core-bot rebrand keep their existing data instead of silently starting
// from an empty database.
import fs from "node:fs";
import path from "node:path";

/** Home-relative state directory used before the rebrand. */
export const LEGACY_STATE_DIR_NAME = ".openclaw";
/** Shared state database filename used before the rebrand. */
export const LEGACY_STATE_SQLITE_FILENAME = "openclaw.sqlite";
/** Per-agent database filename used before the rebrand. */
export const LEGACY_AGENT_SQLITE_FILENAME = "openclaw-agent.sqlite";

/** SQLite sidecar suffixes that must move together with their database file. */
const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm", "-journal"] as const;

export type LegacyRenameOutcome =
  | "renamed"
  | "skipped-current-exists"
  | "skipped-missing-legacy"
  | "skipped-same-path"
  | "failed";

/**
 * Rename a legacy SQLite database (plus any sidecars) onto the current filename.
 *
 * The rename is deliberately non-destructive: it never overwrites an existing current
 * file, so an install that already wrote rows to the new database keeps them and the
 * operator can reconcile the legacy file manually.
 */
export function renameLegacySqliteFile(params: {
  currentPath: string;
  legacyPath: string;
}): LegacyRenameOutcome {
  const { currentPath, legacyPath } = params;
  if (currentPath === legacyPath) {
    return "skipped-same-path";
  }
  if (!fs.existsSync(legacyPath)) {
    return "skipped-missing-legacy";
  }
  if (fs.existsSync(currentPath)) {
    return "skipped-current-exists";
  }
  try {
    for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
      const legacySidecar = `${legacyPath}${suffix}`;
      const currentSidecar = `${currentPath}${suffix}`;
      if (!fs.existsSync(legacySidecar) || fs.existsSync(currentSidecar)) {
        continue;
      }
      fs.renameSync(legacySidecar, currentSidecar);
    }
    fs.renameSync(legacyPath, currentPath);
    return "renamed";
  } catch {
    return "failed";
  }
}

/**
 * Rename a legacy state directory onto the current name.
 *
 * Only the default (home-relative) state directory is migrated, and only when the
 * current directory does not exist yet, so an explicit `QUIET_CORE_STATE_DIR` or an
 * already-upgraded install is never touched.
 */
export function renameLegacyStateDir(params: {
  currentDir: string;
  legacyDir: string;
}): LegacyRenameOutcome {
  const { currentDir, legacyDir } = params;
  if (currentDir === legacyDir) {
    return "skipped-same-path";
  }
  if (!fs.existsSync(legacyDir)) {
    return "skipped-missing-legacy";
  }
  if (fs.existsSync(currentDir)) {
    return "skipped-current-exists";
  }
  try {
    fs.renameSync(legacyDir, currentDir);
    return "renamed";
  } catch {
    return "failed";
  }
}

/** Rename `${dir}/openclaw.sqlite` onto `${dir}/quiet-core-bot.sqlite` when needed. */
export function migrateLegacyStateDatabaseFile(currentPath: string): LegacyRenameOutcome {
  return renameLegacySqliteFile({
    currentPath,
    legacyPath: path.join(path.dirname(currentPath), LEGACY_STATE_SQLITE_FILENAME),
  });
}

/** Rename `${dir}/openclaw-agent.sqlite` onto `${dir}/quiet-core-bot-agent.sqlite` when needed. */
export function migrateLegacyAgentDatabaseFile(currentPath: string): LegacyRenameOutcome {
  return renameLegacySqliteFile({
    currentPath,
    legacyPath: path.join(path.dirname(currentPath), LEGACY_AGENT_SQLITE_FILENAME),
  });
}
