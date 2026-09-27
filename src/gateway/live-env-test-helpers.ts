/**
 * Environment snapshot helpers for live gateway tests.
 */
import { deleteTestEnvValue, setTestEnvValue } from "../test-utils/env.js";

const COMMON_LIVE_ENV_NAMES = [
  "QUIET_CORE_AGENT_RUNTIME",
  "QUIET_CORE_CONFIG_PATH",
  "QUIET_CORE_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "QUIET_CORE_SKIP_BROWSER_CONTROL_SERVER",
  "QUIET_CORE_SKIP_CANVAS_HOST",
  "QUIET_CORE_SKIP_CHANNELS",
  "QUIET_CORE_SKIP_CRON",
  "QUIET_CORE_SKIP_GMAIL_WATCHER",
  "QUIET_CORE_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

/** Captures live-test environment variables so tests can restore them later. */
export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

/** Restores a previously captured live-test environment snapshot. */
export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      deleteTestEnvValue(name);
    } else {
      setTestEnvValue(name, value);
    }
  }
}
