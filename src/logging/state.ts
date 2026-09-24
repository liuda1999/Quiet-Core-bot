// Process-local logging state shared by logger, console capture, and test reset helpers.
export const loggingState = {
  cachedLogger: null as unknown,
  cachedSettings: null as unknown,
  cachedConsoleSettings: null as unknown,
  overrideSettings: null as unknown,
  invalidEnvLogLevelValue: null as string | null,
  consolePatched: false,
  forceConsoleToStderr: false,
  // Routes only diagnostics (subsystem logs and root logger info/warn lines) to
  // stderr, leaving explicit `console.log`/`runtime.log` command output alone.
  // Used by `--json` invocations so machine-readable stdout stays parseable.
  forceDiagnosticsToStderr: false,
  consoleTimestampPrefix: false,
  consoleSubsystemFilter: null as string[] | null,
  resolvingConsoleSettings: false,
  streamErrorHandlersInstalled: false,
  rawConsole: null as {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null,
};
