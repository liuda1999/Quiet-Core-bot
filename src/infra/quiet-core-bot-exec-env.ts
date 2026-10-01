/** Process env key that marks child commands as launched by the Quiet Core bot CLI. */
export const QUIET_CORE_CLI_ENV_VAR = "QUIET_CORE_CLI";

/** Stable marker value used for Quiet Core bot-launched subprocess detection. */
export const QUIET_CORE_CLI_ENV_VALUE = "1";

/** Returns a cloned env object with the Quiet Core bot CLI marker set. */
export function markQuietCoreExecEnv<T extends Record<string, string | undefined>>(
  /** Source environment to clone before adding the subprocess marker. */
  env: T,
): T {
  return {
    ...env,
    [QUIET_CORE_CLI_ENV_VAR]: QUIET_CORE_CLI_ENV_VALUE,
  };
}

/** Mutates an existing process env object so current-process children inherit the marker. */
export function ensureQuietCoreExecMarkerOnProcess(
  /** Process env object to mutate; defaults to the current process environment. */
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[QUIET_CORE_CLI_ENV_VAR] = QUIET_CORE_CLI_ENV_VALUE;
  return env;
}
