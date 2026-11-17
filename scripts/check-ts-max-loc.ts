// Check Ts Max Loc script supports QuietCore repository automation.
//
// The repository has ~1.9k TypeScript files above 500 lines, so this check is
// advisory by default: it reports the largest offenders and exits 0. Pass
// `--fail` (see `pnpm check:loc:strict`) to enforce the limit in a gate.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function writeStdoutLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

type ParsedArgs = {
  maxLines: number;
  fail: boolean;
  all: boolean;
};

/** Vendored sources keep their upstream file layout; do not split them. */
const EXEMPT_PREFIXES = ["src/web-tools/"] as const;
const DEFAULT_REPORT_LIMIT = 20;

function parseArgs(argv: string[]): ParsedArgs {
  let maxLines = 500;
  let fail = false;
  let all = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--max") {
      const next = argv[index + 1];
      if (!next || !/^\d+$/u.test(next)) {
        throw new Error("--max requires a positive integer");
      }
      maxLines = Number(next);
      if (!Number.isSafeInteger(maxLines) || maxLines <= 0) {
        throw new Error("--max requires a positive integer");
      }
      index++;
      continue;
    }
    if (arg === "--fail") {
      fail = true;
      continue;
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { maxLines, fail, all };
}

function gitLsFilesAll(): string[] {
  // Include untracked files too so local refactors don’t “pass” by accident.
  const stdout = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function countLines(filePath: string): Promise<number> {
  const content = await readFile(filePath, "utf8");
  // Count physical lines. Keeps the rule simple + predictable.
  return content.split("\n").length;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  // Makes `... | head` safe.
  process.stdout.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") {
      process.exit(0);
    }
    throw error;
  });

  const { maxLines, fail, all } = parseArgs(argv);
  const files = gitLsFilesAll()
    .filter((filePath) => existsSync(filePath))
    .filter((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
    .filter((filePath) => !EXEMPT_PREFIXES.some((prefix) => filePath.startsWith(prefix)));

  // Read sequentially: Promise.all over the whole tree exhausts file handles on
  // Windows (EMFILE) long before it finishes.
  const results: { filePath: string; lines: number }[] = [];
  for (const filePath of files) {
    results.push({ filePath, lines: await countLines(filePath) });
  }

  const offenders = results
    .filter((result) => result.lines > maxLines)
    .toSorted((a, b) => b.lines - a.lines);

  if (!offenders.length) {
    writeStdoutLine(`All ${files.length} TypeScript files are within ${maxLines} lines.`);
    return 0;
  }

  // Minimal, grep-friendly output.
  const reported = all ? offenders : offenders.slice(0, DEFAULT_REPORT_LIMIT);
  for (const offender of reported) {
    writeStdoutLine(`${offender.lines}\t${offender.filePath}`);
  }
  if (reported.length < offenders.length) {
    writeStdoutLine(
      `... and ${offenders.length - reported.length} more (pass --all to list every file).`,
    );
  }

  if (!fail) {
    process.stderr.write(
      `check-ts-max-loc: ${offenders.length}/${files.length} TypeScript files exceed ${maxLines} lines ` +
        "(advisory; pass --fail to enforce).\n",
    );
    return 0;
  }

  return 1;
}

try {
  const exitCode = await main();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
