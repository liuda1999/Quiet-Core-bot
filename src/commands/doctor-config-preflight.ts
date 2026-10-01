/** Config preflight for doctor: state migration, recovery, and snapshot loading. */
import { note } from "../../packages/terminal-core/src/note.js";
import {
  readConfigFileSnapshot,
  recoverConfigFromJsonRootSuffix,
  recoverConfigFromLastKnownGood,
} from "../config/io.js";
import { formatConfigIssueLines } from "../config/issue-format.js";
import type { ConfigFileSnapshot, LegacyConfigIssue } from "../config/types.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { noteIncludeConfinementWarning } from "./doctor-config-analysis.js";
import { findDoctorLegacyConfigIssues } from "./doctor/shared/legacy-config-issues.js";

type DoctorStateMigrationsModule = typeof import("./doctor-state-migrations.js");
type DoctorCronModule = typeof import("./doctor/cron/index.js");

let doctorStateMigrationsPromise: Promise<DoctorStateMigrationsModule> | null = null;
let doctorCronPromise: Promise<DoctorCronModule> | null = null;

function loadDoctorStateMigrations(): Promise<DoctorStateMigrationsModule> {
  doctorStateMigrationsPromise ??= import("./doctor-state-migrations.js");
  return doctorStateMigrationsPromise;
}

function loadDoctorCron(): Promise<DoctorCronModule> {
  doctorCronPromise ??= import("./doctor/cron/index.js");
  return doctorCronPromise;
}

export type DoctorConfigPreflightResult = {
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>;
  baseConfig: QuietCoreConfig;
};

function collectDoctorLegacyIssues(
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>,
): LegacyConfigIssue[] {
  if (!snapshot.exists) {
    return [];
  }
  const resolvedRaw = snapshot.sourceConfig ?? snapshot.config ?? {};
  const sourceRaw = snapshot.parsed ?? resolvedRaw;
  return findDoctorLegacyConfigIssues(resolvedRaw, sourceRaw);
}

function addDoctorLegacyIssues(
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>,
): Awaited<ReturnType<typeof readConfigFileSnapshot>> {
  const legacyIssues = collectDoctorLegacyIssues(snapshot);
  if (legacyIssues.length === 0) {
    return snapshot;
  }
  return { ...snapshot, legacyIssues };
}

/** Returns true during updater-managed config rewrites where plugin validation may be stale. */
export function shouldSkipPluginValidationForDoctorConfigPreflight(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTruthyEnvValue(env.QUIET_CORE_UPDATE_IN_PROGRESS);
}

function noteStateMigrationResult(
  result: { changes: string[]; warnings: string[] },
  options: { showWarnings?: boolean } = {},
): void {
  if (result.changes.length > 0) {
    note(result.changes.map((entry) => `- ${entry}`).join("\n"), "Doctor changes");
  }
  if (options.showWarnings !== false && result.warnings.length > 0) {
    note(result.warnings.map((entry) => `- ${entry}`).join("\n"), "Doctor warnings");
  }
}

/**
 * Runs early doctor config checks before the main config repair flow.
 *
 * It may migrate legacy state/config paths, recover corrupt target config when requested, and
 * returns the best-effort config snapshot used by later doctor checks.
 */
export async function runDoctorConfigPreflight(
  options: {
    migrateState?: boolean;
    migrateLegacyConfig?: boolean;
    repairPrefixedConfig?: boolean;
    recoverCorruptTargetStore?: boolean;
    invalidConfigNote?: string | false;
    beforeStateMigrations?: (snapshot?: ConfigFileSnapshot) => Promise<boolean>;
    showStateMigrationWarnings?: boolean;
  } = {},
): Promise<DoctorConfigPreflightResult> {
  const stateMigrations =
    options.migrateState !== false ? await loadDoctorStateMigrations() : undefined;
  // The gateway uses this last-moment guard to ensure its prepared config did not change before
  // any automatic migration mutates state. A rejected guard skips every state migration stage.
  const stateMigrationsAllowed =
    stateMigrations === undefined ||
    options.beforeStateMigrations === undefined ||
    (await options.beforeStateMigrations());

  const readOptions = {
    skipPluginValidation: shouldSkipPluginValidationForDoctorConfigPreflight(),
  };
  let snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
  if (options.repairPrefixedConfig === true && snapshot.exists && !snapshot.valid) {
    if (await recoverConfigFromJsonRootSuffix(snapshot)) {
      note(
        "Removed non-JSON prefix from quiet-core-bot.json; original saved as .clobbered.*.",
        "Config",
      );
      snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
    } else if (
      await recoverConfigFromLastKnownGood({ snapshot, reason: "doctor-invalid-config" })
    ) {
      note(
        "Restored quiet-core-bot.json from last-known-good; original saved as .clobbered.*.",
        "Config",
      );
      snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
    }
  }
  const invalidConfigNote =
    options.invalidConfigNote ?? "Config invalid; doctor will run with best-effort config.";
  if (
    invalidConfigNote &&
    snapshot.exists &&
    !snapshot.valid &&
    snapshot.legacyIssues.length === 0
  ) {
    note(invalidConfigNote, "Config");
    noteIncludeConfinementWarning(snapshot);
  }

  const warnings = snapshot.warnings ?? [];
  if (warnings.length > 0) {
    note(formatConfigIssueLines(warnings, "-").join("\n"), "Config warnings");
  }

  const baseConfig = snapshot.sourceConfig ?? snapshot.config ?? {};
  const configStateMigrationsAllowed =
    stateMigrations !== undefined &&
    stateMigrationsAllowed &&
    (options.beforeStateMigrations === undefined ||
      (await options.beforeStateMigrations(snapshot)));
  if (stateMigrations && configStateMigrationsAllowed) {
    const { autoMigrateLegacyState, autoMigrateLegacyTaskStateSidecars } = stateMigrations;
    if (snapshot.valid) {
      const { repairLegacyCronStoreWithoutPrompt } = await loadDoctorCron();
      const cronResult = await repairLegacyCronStoreWithoutPrompt({ cfg: baseConfig });
      noteStateMigrationResult(cronResult, { showWarnings: options.showStateMigrationWarnings });
      noteStateMigrationResult(
        await autoMigrateLegacyState({
          cfg: baseConfig,
          env: process.env,
          recoverCorruptTargetStore: options.recoverCorruptTargetStore,
        }),
        { showWarnings: options.showStateMigrationWarnings },
      );
    } else {
      noteStateMigrationResult(await autoMigrateLegacyTaskStateSidecars({ env: process.env }), {
        showWarnings: options.showStateMigrationWarnings,
      });
    }
  }

  return {
    snapshot,
    baseConfig,
  };
}
