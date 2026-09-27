// Env log level helpers normalize log level values from environment variables.
import { normalizeOptionalString } from "@quiet-core/normalization-core/string-coerce";
import { ALLOWED_LOG_LEVELS, type LogLevel, tryParseLogLevel } from "./levels.js";
import { loggingState } from "./state.js";

/** Resolves QUIET_CORE_LOG_LEVEL once per value, warning only when the invalid value changes. */
export function resolveEnvLogLevelOverride(): LogLevel | undefined {
  const trimmed = normalizeOptionalString(process.env.QUIET_CORE_LOG_LEVEL) ?? "";
  if (!trimmed) {
    loggingState.invalidEnvLogLevelValue = null;
    return undefined;
  }
  const parsed = tryParseLogLevel(trimmed);
  if (parsed) {
    loggingState.invalidEnvLogLevelValue = null;
    return parsed;
  }
  if (loggingState.invalidEnvLogLevelValue !== trimmed) {
    loggingState.invalidEnvLogLevelValue = trimmed;
    process.stderr.write(
      `[quiet-core-bot] Ignoring invalid QUIET_CORE_LOG_LEVEL="${trimmed}" (allowed: ${ALLOWED_LOG_LEVELS.join("|")}).\n`,
    );
  }
  return undefined;
}
