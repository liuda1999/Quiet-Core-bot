// One-off state directory relocation for the Quiet Core bot rebrand.
//
// Moves (by copying) a pre-rebrand state dir such as `~/.openclaw` to the
// current `~/.quiet-core-bot`, renaming the config file along the way. The
// source directory is never modified. Previews by default; requires `--yes` to
// apply. Exit code is non-zero when verification fails, so it is safe to script.
//
// Usage:
//   node --import tsx scripts/migrate-state-dir.ts --dry-run
//   node --import tsx scripts/migrate-state-dir.ts --yes
//   node --import tsx scripts/migrate-state-dir.ts --from <dir> --to <dir> --yes --json
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  CONFIG_FILE_NAME,
  PREVIOUS_STATE_DIR_NAMES,
  resolveLegacyStateDirs,
  resolveNewStateDir,
} from "../src/config/paths.js";
import {
  applyStateDirMigration,
  planStateDirMigration,
  type StateDirMigrationPlan,
  verifyStateDirMigration,
} from "../src/config/state-dir-migration.js";

type CliOptions = {
  from?: string;
  to?: string;
  apply: boolean;
  json: boolean;
  overwrite: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false, json: false, overwrite: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--from":
        options.from = argv[++index];
        break;
      case "--to":
        options.to = argv[++index];
        break;
      case "--yes":
      case "--apply":
        options.apply = true;
        break;
      case "--dry-run":
        options.apply = false;
        break;
      case "--no-overwrite":
        options.overwrite = false;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        if (arg?.startsWith("--")) {
          throw new Error(`unknown flag: ${arg}`);
        }
    }
  }
  return options;
}

/** Picks the most recent existing legacy state dir as the default source. */
function resolveDefaultSource(): string {
  const candidates = resolveLegacyStateDirs();
  for (const dir of [...candidates].reverse()) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  throw new Error(
    `no legacy state dir found (expected one of: ${PREVIOUS_STATE_DIR_NAMES.join(", ")})`,
  );
}

function describePlan(plan: StateDirMigrationPlan): string {
  const lines: string[] = [
    `source: ${plan.from}`,
    `target: ${plan.to}`,
    `to copy: ${plan.stats.toCopy}, skipped (transient): ${plan.stats.skipped}`,
    `existing target entries (backed up before overwrite): ${plan.stats.conflicts}`,
  ];
  lines.push(
    plan.configRename
      ? `config: ${path.basename(plan.configRename.sourcePath)} -> ${CONFIG_FILE_NAME}`
      : `config: none found (target will have no ${CONFIG_FILE_NAME})`,
  );
  const skipped = plan.entries
    .filter((entry) => entry.action === "skip")
    .map((entry) => entry.name);
  if (skipped.length > 0) {
    lines.push(`skipped entries: ${skipped.join(", ")}`);
  }
  return lines.join("\n");
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const from = options.from ?? resolveDefaultSource();
  const to = options.to ?? resolveNewStateDir();

  if (path.resolve(from) === path.resolve(to)) {
    throw new Error("source and target resolve to the same directory");
  }

  const plan = await planStateDirMigration({ from, to });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ plan, applied: false }, null, 2)}\n`);
  } else {
    process.stdout.write(`${describePlan(plan)}\n`);
  }

  if (!options.apply) {
    if (!options.json) {
      process.stdout.write("\nDry run only. Re-run with --yes to apply.\n");
    }
    return 0;
  }

  if (!options.json) {
    const proceed = await confirm("Proceed with the migration?");
    if (!proceed) {
      process.stdout.write("Aborted.\n");
      return 1;
    }
  }

  const applied = await applyStateDirMigration({ plan, overwrite: options.overwrite });
  const verification = await verifyStateDirMigration({ from, to });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ plan, applied, verification }, null, 2)}\n`);
  } else {
    process.stdout.write(
      `\ncopied: ${applied.copied.length}, skipped (already present): ${applied.skippedExisting.length}` +
        `, conflict backups: ${applied.conflictBackups.length}\n`,
    );
    process.stdout.write(`config written: ${applied.configPath ?? "(none)"}\n`);
    for (const [name, counts] of Object.entries(verification.counts)) {
      process.stdout.write(
        `verify ${name}: source=${counts.source} target=${counts.target}` +
          `${counts.source === counts.target ? " OK" : " MISMATCH"}\n`,
      );
    }
    process.stdout.write(
      verification.ok
        ? "Verification OK. The source directory was left untouched.\n"
        : `Verification FAILED for: ${verification.mismatch.join(", ")}\n`,
    );
  }

  return verification.ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`state dir migration failed: ${message}\n`);
    process.exitCode = 1;
  });
