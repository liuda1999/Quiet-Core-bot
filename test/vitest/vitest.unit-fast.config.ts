// Vitest unit fast config wires the unit fast test shard.
import { defineConfig } from "vitest/config";
import { loadPatternListFromEnv, narrowIncludePatternsForCli } from "./vitest.pattern-file.ts";
import { sharedVitestConfig } from "./vitest.shared.config.ts";
import {
  getUnitFastTestFiles,
  getUnitFastTimerTestFiles,
  windowsUnsupportedUnitFastTestFiles,
} from "./vitest.unit-fast-paths.mjs";

export function createUnitFastVitestConfig(
  env: Record<string, string | undefined> = process.env,
  options: { argv?: string[] } = {},
) {
  const sharedTest = sharedVitestConfig.test ?? {};
  const includeFromEnv = loadPatternListFromEnv("QUIET_CORE_VITEST_INCLUDE_FILE", env);
  const timerTestFiles = new Set(getUnitFastTimerTestFiles());
  const unitFastTestFiles = getUnitFastTestFiles().filter((file) => !timerTestFiles.has(file));
  const cliInclude = narrowIncludePatternsForCli(unitFastTestFiles, options.argv);
  // Keep the local Windows lane honest: these tests still run on Linux CI but
  // cannot run reliably on Windows (offline Go modules, PTY timing, mock
  // isolation). See windowsUnsupportedUnitFastTestFiles for the rationale.
  const platformExcludes = process.platform === "win32" ? windowsUnsupportedUnitFastTestFiles : [];

  return defineConfig({
    ...sharedVitestConfig,
    test: {
      ...sharedTest,
      name: "unit-fast",
      isolate: false,
      runner: undefined,
      // Keep the shared isolated HOME/bootstrap even though the fast lane skips
      // per-file module isolation. Without it these workers fall back to the
      // developer's real HOME/state database and concurrent workers thrash the
      // same state DB (which stalls whole shards on a populated machine).
      setupFiles: sharedTest.setupFiles,
      include: includeFromEnv ?? cliInclude ?? unitFastTestFiles,
      exclude: [...(sharedTest.exclude ?? []), ...platformExcludes],
      passWithNoTests: true,
    },
  });
}

export default createUnitFastVitestConfig();
