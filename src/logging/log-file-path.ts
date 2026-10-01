// Log file path helpers resolve log output paths for local runtime logs.
import path from "node:path";
import type { QuietCoreConfig } from "../config/types.js";
import {
  POSIX_QUIET_CORE_TMP_DIR,
  resolvePreferredQuietCoreTmpDir,
} from "../infra/tmp-quiet-core-bot-dir.js";
import { canUseNodeFs, formatLocalDate, LOG_PREFIX, LOG_SUFFIX } from "./log-file-shared.js";

function resolveDefaultRollingLogFile(date = new Date()): string {
  const logDir = canUseNodeFs() ? resolvePreferredQuietCoreTmpDir() : POSIX_QUIET_CORE_TMP_DIR;
  return path.join(logDir, `${LOG_PREFIX}-${formatLocalDate(date)}${LOG_SUFFIX}`);
}

/** Resolves the configured log file or today's rolling default log path. */
export function resolveConfiguredLogFilePath(config?: QuietCoreConfig | null): string {
  return config?.logging?.file ?? resolveDefaultRollingLogFile();
}
