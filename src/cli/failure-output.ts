// Shared root CLI failure formatting with debug stack gating and recovery hints.
import { isTruthyEnvValue } from "../infra/env.js";
import { formatErrorMessage, formatUncaughtError } from "../infra/errors.js";
import { formatCliCommand } from "./command-format.js";

type FormatCliFailureOptions = {
  title: string;
  error: unknown;
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  includeDoctorHint?: boolean;
};

function hasDebugArg(argv: string[] | undefined): boolean {
  return Boolean(argv?.some((arg) => arg === "--debug" || arg === "--verbose"));
}

function shouldShowStack(argv: string[] | undefined, env: NodeJS.ProcessEnv): boolean {
  return hasDebugArg(argv) || isTruthyEnvValue(env.QUIET_CORE_DEBUG);
}

function pushPrefixed(out: string[], value: string): void {
  for (const line of value.split("\n")) {
    if (line.trim().length > 0) {
      out.push(`[quiet-core-bot] ${line}`);
    }
  }
}

export function formatCliFailureLines(options: FormatCliFailureOptions): string[] {
  // Default output stays terse; stack traces require explicit debug intent.
  const env = options.env ?? process.env;
  const lines = [
    `[quiet-core-bot] ${options.title}`,
    `[quiet-core-bot] Reason: ${formatErrorMessage(options.error)}`,
  ];

  if (shouldShowStack(options.argv, env)) {
    lines.push("[quiet-core-bot] Stack:");
    pushPrefixed(lines, formatUncaughtError(options.error));
  } else {
    lines.push("[quiet-core-bot] Debug: set QUIET_CORE_DEBUG=1 to include the stack trace.");
  }

  if (options.includeDoctorHint !== false) {
    lines.push(`[quiet-core-bot] Try: ${formatCliCommand("quiet-core-bot doctor", env)}`);
  }
  lines.push(`[quiet-core-bot] Help: ${formatCliCommand("quiet-core-bot --help", env)}`);
  return lines;
}
