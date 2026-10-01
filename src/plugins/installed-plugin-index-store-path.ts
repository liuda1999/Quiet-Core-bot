// Resolves filesystem paths for installed plugin index storage.
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type { QuietCoreStateDatabaseOptions } from "../state/quiet-core-bot-state-db.js";
import { resolveQuietCoreStateSqlitePath } from "../state/quiet-core-bot-state-db.paths.js";

const LEGACY_INSTALLED_PLUGIN_INDEX_STORE_PATH = path.join("plugins", "installs.json");

/** Options for resolving installed plugin index storage paths. */
export type InstalledPluginIndexStoreOptions = {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
  filePath?: string;
};

function resolveStoreEnv(options: InstalledPluginIndexStoreOptions): NodeJS.ProcessEnv {
  return options.stateDir
    ? { ...(options.env ?? process.env), QUIET_CORE_STATE_DIR: options.stateDir }
    : (options.env ?? process.env);
}

/** Resolves the canonical SQLite-backed installed plugin index path. */
export function resolveInstalledPluginIndexStorePath(
  options: InstalledPluginIndexStoreOptions = {},
): string {
  if (options.filePath) {
    return options.filePath;
  }
  return resolveQuietCoreStateSqlitePath(resolveStoreEnv(options));
}

/** Resolves state database options for the installed plugin index store. */
export function resolveInstalledPluginIndexStateDatabaseOptions(
  options: InstalledPluginIndexStoreOptions = {},
): QuietCoreStateDatabaseOptions {
  if (options.filePath) {
    return {
      ...(options.env ? { env: options.env } : {}),
      path: options.filePath,
    };
  }
  if (options.stateDir) {
    return {
      env: resolveStoreEnv(options),
    };
  }
  return options.env ? { env: options.env } : {};
}

/** Resolves the legacy JSON installed plugin index path for migration/doctor use. */
export function resolveLegacyInstalledPluginIndexStorePath(
  options: InstalledPluginIndexStoreOptions = {},
): string {
  if (options.filePath) {
    return options.filePath;
  }
  const env = options.env ?? process.env;
  const stateDir = options.stateDir ?? resolveStateDir(env);
  return path.join(stateDir, LEGACY_INSTALLED_PLUGIN_INDEX_STORE_PATH);
}
