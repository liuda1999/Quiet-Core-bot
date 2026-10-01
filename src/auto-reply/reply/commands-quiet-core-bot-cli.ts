// Formats Quiet Core bot CLI command snippets for chat-facing command responses.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isBunRuntime } from "../../daemon/runtime-binary.js";
import { resolveQuietCorePackageRootSync } from "../../infra/quiet-core-bot-root.js";

const requireFromHere = createRequire(import.meta.url);
const QUIET_CORE_CLI_ENTRY_BASENAMES = new Set(["quiet-core-bot", "quiet-core-bot.mjs"]);
const QUIET_CORE_PACKAGE_ENTRY_PATHS = new Set([
  path.join("dist", "entry.js"),
  path.join("dist", "entry.mjs"),
  path.join("dist", "index.js"),
  path.join("dist", "index.mjs"),
  path.join("src", "entry.ts"),
]);
const TEST_RUNNER_ENV_PREFIXES = ["VITEST_", "QUIET_CORE_VITEST_"];

function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isQuietCoreCliLauncherEntry(entry: string): boolean {
  return QUIET_CORE_CLI_ENTRY_BASENAMES.has(path.basename(entry));
}

function isQuietCorePackageEntry(entry: string, packageRoot: string): boolean {
  const relativeEntry = path.relative(path.resolve(packageRoot), path.resolve(entry));
  return QUIET_CORE_PACKAGE_ENTRY_PATHS.has(relativeEntry);
}

function safeCwd(): string | undefined {
  try {
    return process.cwd();
  } catch {
    return undefined;
  }
}

function buildPackageRootCliArgvPrefix(packageRoot: string): string[] {
  const sourceEntry = path.join(packageRoot, "src", "entry.ts");
  if (fs.existsSync(sourceEntry)) {
    const tsxLoader = resolveTrustedTsxLoader(packageRoot);
    return isBunRuntime(process.execPath)
      ? [process.execPath, sourceEntry]
      : tsxLoader
        ? [process.execPath, "--import", tsxLoader, sourceEntry]
        : [process.execPath, path.join(packageRoot, "quiet-core-bot.mjs")];
  }
  return [process.execPath, path.join(packageRoot, "quiet-core-bot.mjs")];
}

function resolveTrustedTsxLoader(packageRoot: string): string | null {
  try {
    return requireFromHere.resolve("tsx", { paths: [packageRoot] });
  } catch {
    return null;
  }
}

function resolveCurrentQuietCoreCliArgvPrefix(): string[] {
  const entry = process.argv[1]?.trim();
  if (entry && entry !== process.execPath && isQuietCoreCliLauncherEntry(entry)) {
    return [process.execPath, ...process.execArgv, entry];
  }
  const entryPackageRoot = entry ? resolveQuietCorePackageRootSync({ argv1: entry }) : null;
  if (entry && entryPackageRoot && isQuietCorePackageEntry(entry, entryPackageRoot)) {
    return [process.execPath, ...process.execArgv, entry];
  }
  const packageRoot = resolveQuietCorePackageRootSync({
    argv1: entry,
    cwd: safeCwd(),
    moduleUrl: import.meta.url,
  });
  if (packageRoot) {
    return buildPackageRootCliArgvPrefix(packageRoot);
  }
  return entry && entry !== process.execPath ? [process.execPath, entry] : [process.execPath];
}

/** Reconstructs the current Quiet Core bot CLI invocation with extra args. */
export function buildCurrentQuietCoreCliArgv(args: string[]): string[] {
  return [...resolveCurrentQuietCoreCliArgvPrefix(), ...args];
}

/** Clears test-runner env inherited by harness-hosted gateways before spawning the CLI. */
export function buildCurrentQuietCoreCliExecEnv(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> | undefined {
  const overrides: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    if (key === "VITEST" || TEST_RUNNER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      overrides[key] = "";
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/** Builds a shell-quoted command string for rerunning the current Quiet Core bot CLI. */
export function buildCurrentQuietCoreCliCommand(args: string[]): string {
  return buildCurrentQuietCoreCliArgv(args).map(quoteShellArg).join(" ");
}
