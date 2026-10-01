// CLI-name helpers keep generated examples aligned with the binary the user invoked.
import path from "node:path";

const DEFAULT_CLI_NAME = "quiet-core-bot";

// Legacy example strings written before the rebrand are still normalized to the current
// binary name; the binary itself is renamed.
const LEGACY_CLI_NAME = "openclaw";

const KNOWN_CLI_NAMES = new Set([DEFAULT_CLI_NAME]);
const CLI_PREFIX_RE = new RegExp(
  `^(?:((?:pnpm|npm|bunx|npx)\\s+))?(${DEFAULT_CLI_NAME}|${LEGACY_CLI_NAME})\\b`,
);

/** Resolve the displayed CLI binary name from argv, falling back to `quiet-core-bot`. */
export function resolveCliName(argv: string[] = process.argv): string {
  const argv1 = argv[1];
  if (!argv1) {
    return DEFAULT_CLI_NAME;
  }
  const base = path.basename(argv1).trim();
  if (KNOWN_CLI_NAMES.has(base)) {
    return base;
  }
  return DEFAULT_CLI_NAME;
}

/** Replace a leading CLI command prefix with the active CLI name. */
export function replaceCliName(command: string, cliName = resolveCliName()): string {
  if (!command.trim()) {
    return command;
  }
  if (!CLI_PREFIX_RE.test(command)) {
    return command;
  }
  return command.replace(CLI_PREFIX_RE, (_match, runner: string | undefined) => {
    return `${runner ?? ""}${cliName}`;
  });
}
