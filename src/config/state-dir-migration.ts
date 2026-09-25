import type { Dirent } from "node:fs";
// Plans, applies, and verifies a one-off state directory relocation.
//
// Used by the rebrand migration (pre-rebrand `~/.openclaw` -> current
// `~/.quiet-core-bot`). Planning is side-effect free so callers can preview the
// exactly work before touching the filesystem; applying never writes to the
// source directory, and verification compares substantive subtrees so a partial
// copy can never be reported as success.
import fs from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_FILE_NAME,
  PREVIOUS_CONFIG_FILE_NAMES,
  STATE_DIR_SUBSTANTIVE_DIR_NAMES,
} from "./paths.js";

/** Top-level directories that hold transient data and are never migrated. */
const SKIP_DIR_NAMES = new Set(["tmp", "logs"]);
/** File-name patterns that are transient by nature and are never migrated. */
const SKIP_FILE_PATTERNS = [/\.lock$/iu, /\.tmp$/iu, /\.DS_Store$/iu] as const;
/** Suffix used when an existing target entry is backed up before overwrite. */
const CONFLICT_BACKUP_SUFFIX = ".pre-migration";

export type StateDirMigrationEntryKind = "directory" | "file";

export type StateDirMigrationEntry = {
  /** Top-level entry name, identical under source and target. */
  name: string;
  kind: StateDirMigrationEntryKind;
  sourcePath: string;
  targetPath: string;
  action: "copy" | "skip";
  skipReason?: "transient";
  targetExists: boolean;
};

export type StateDirMigrationPlan = {
  from: string;
  to: string;
  entries: StateDirMigrationEntry[];
  /**
   * Config file carried over from the source and renamed to the current config
   * file name. `null` when the source has no recognizable config file.
   */
  configRename: { sourcePath: string; targetPath: string } | null;
  stats: { toCopy: number; skipped: number; conflicts: number };
};

export type StateDirMigrationApplyResult = {
  copied: string[];
  skippedExisting: string[];
  conflictBackups: string[];
  configPath: string | null;
};

export type StateDirMigrationVerification = {
  ok: boolean;
  /** Substantive subtrees whose source/target entry counts disagree. */
  mismatch: string[];
  counts: Record<string, { source: number; target: number }>;
};

function isSkippedFile(name: string): boolean {
  return SKIP_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

async function statOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

async function countFilesRecursive(dir: string): Promise<number> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += await countFilesRecursive(path.join(dir, entry.name));
    } else {
      total += 1;
    }
  }
  return total;
}

/** Picks the config file to carry over, preferring the current name over legacy. */
async function resolveConfigSource(from: string): Promise<string | null> {
  for (const candidate of [CONFIG_FILE_NAME, ...PREVIOUS_CONFIG_FILE_NAMES]) {
    const candidatePath = path.join(from, candidate);
    if (await statOrNull(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}

/**
 * Builds the migration plan without writing anything. Callers should print this
 * (or its stats) before applying so the operator can review the exact work.
 */
export async function planStateDirMigration(params: {
  from: string;
  to: string;
}): Promise<StateDirMigrationPlan> {
  const { from, to } = params;
  const sourceStat = await statOrNull(from);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`state dir migration source is not a directory: ${from}`);
  }

  const configSource = await resolveConfigSource(from);
  const children = await fs.readdir(from, { withFileTypes: true });
  const entries: StateDirMigrationEntry[] = [];

  for (const child of children.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const sourcePath = path.join(from, child.name);
    const targetPath = path.join(to, child.name);
    if (configSource && sourcePath === configSource) {
      continue;
    }
    const transient =
      (child.isDirectory() && SKIP_DIR_NAMES.has(child.name)) ||
      (child.isFile() && isSkippedFile(child.name));
    entries.push({
      name: child.name,
      kind: child.isDirectory() ? "directory" : "file",
      sourcePath,
      targetPath,
      action: transient ? "skip" : "copy",
      ...(transient ? { skipReason: "transient" as const } : {}),
      targetExists: (await statOrNull(targetPath)) !== null,
    });
  }

  return {
    from,
    to,
    entries,
    configRename: configSource
      ? { sourcePath: configSource, targetPath: path.join(to, CONFIG_FILE_NAME) }
      : null,
    stats: {
      toCopy: entries.filter((entry) => entry.action === "copy").length,
      skipped: entries.filter((entry) => entry.action === "skip").length,
      conflicts: entries.filter((entry) => entry.action === "copy" && entry.targetExists).length,
    },
  };
}

async function backupExistingTarget(targetPath: string): Promise<string> {
  let backupPath = `${targetPath}${CONFLICT_BACKUP_SUFFIX}`;
  if (await statOrNull(backupPath)) {
    backupPath = `${targetPath}${CONFLICT_BACKUP_SUFFIX}.${Date.now()}`;
  }
  await fs.rename(targetPath, backupPath);
  return backupPath;
}

/**
 * Applies a plan. Source entries are only ever read. When a target entry already
 * exists it is preserved unless `overwrite` is set, in which case it is first
 * moved aside as `<name>.pre-migration`.
 */
export async function applyStateDirMigration(params: {
  plan: StateDirMigrationPlan;
  overwrite?: boolean;
}): Promise<StateDirMigrationApplyResult> {
  const { plan, overwrite = false } = params;
  const result: StateDirMigrationApplyResult = {
    copied: [],
    skippedExisting: [],
    conflictBackups: [],
    configPath: null,
  };

  await fs.mkdir(plan.to, { recursive: true });

  const copyEntry = async (sourcePath: string, targetPath: string, kind: "directory" | "file") => {
    const exists = (await statOrNull(targetPath)) !== null;
    if (exists) {
      if (!overwrite) {
        result.skippedExisting.push(targetPath);
        return;
      }
      result.conflictBackups.push(await backupExistingTarget(targetPath));
    }
    if (kind === "directory") {
      await fs.cp(sourcePath, targetPath, { recursive: true, force: true });
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
    result.copied.push(targetPath);
  };

  for (const entry of plan.entries) {
    if (entry.action === "skip") {
      continue;
    }
    await copyEntry(entry.sourcePath, entry.targetPath, entry.kind);
  }

  if (plan.configRename) {
    await copyEntry(plan.configRename.sourcePath, plan.configRename.targetPath, "file");
    result.configPath = plan.configRename.targetPath;
  }

  return result;
}

/**
 * Compares the substantive subtrees of source and target. A target that is
 * missing entries for any substantive subtree is reported as a mismatch, so an
 * interrupted copy cannot be mistaken for a completed migration.
 */
export async function verifyStateDirMigration(params: {
  from: string;
  to: string;
}): Promise<StateDirMigrationVerification> {
  const counts: StateDirMigrationVerification["counts"] = {};
  const mismatch: string[] = [];

  for (const name of STATE_DIR_SUBSTANTIVE_DIR_NAMES) {
    const sourceDir = path.join(params.from, name);
    const sourceCount = (await statOrNull(sourceDir))?.isDirectory()
      ? await countFilesRecursive(sourceDir)
      : 0;
    if (sourceCount === 0) {
      continue;
    }
    const targetDir = path.join(params.to, name);
    const targetCount = (await statOrNull(targetDir))?.isDirectory()
      ? await countFilesRecursive(targetDir)
      : 0;
    counts[name] = { source: sourceCount, target: targetCount };
    if (targetCount !== sourceCount) {
      mismatch.push(name);
    }
  }

  const configPath = path.join(params.to, CONFIG_FILE_NAME);
  if ((await statOrNull(configPath)) === null) {
    mismatch.push(CONFIG_FILE_NAME);
  }

  return { ok: mismatch.length === 0, mismatch, counts };
}
