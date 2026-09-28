// Shared test setup installs common Vitest mocks and cleanup behavior.
import os from "node:os";
import path from "node:path";
import { beforeAll, vi } from "vitest";

const openAiCodexTokenRefreshTestHook = "__QUIET_CORE_TEST_REFRESH_OPENAI_CODEX_TOKEN__";
type GlobalWithOpenAiCodexTokenRefreshTestHook = typeof globalThis & {
  [openAiCodexTokenRefreshTestHook]?: ((...args: unknown[]) => unknown) | undefined;
};

vi.mock("../src/llm/oauth.js", () => ({
  getOAuthApiKey: () => undefined,
  getOAuthProviders: () => [],
  loginOpenAICodex: vi.fn(),
  refreshOpenAICodexToken: vi.fn((...args: unknown[]) =>
    (globalThis as GlobalWithOpenAiCodexTokenRefreshTestHook)[openAiCodexTokenRefreshTestHook]?.(
      ...args,
    ),
  ),
  resetOAuthProviders: vi.fn(),
}));

vi.mock("@mariozechner/clipboard", () => ({
  availableFormats: () => [],
  getText: async () => "",
  setText: async () => {},
  hasText: () => false,
  getImageBinary: async () => [],
  getImageBase64: async () => "",
  setImageBinary: async () => {},
  setImageBase64: async () => {},
  hasImage: () => false,
  getHtml: async () => "",
  setHtml: async () => {},
  hasHtml: () => false,
  getRtf: async () => "",
  setRtf: async () => {},
  hasRtf: () => false,
  clear: async () => {},
  watch: () => {},
  callThreadsafeFunction: () => {},
}));

// Ensure Vitest environment is properly set.
process.env.VITEST = "true";
// Tests frequently point bundled plugin discovery at temp fixture roots. Production still rejects
// arbitrary QUIET_CORE_BUNDLED_PLUGINS_DIR overrides unless this Vitest-only opt-in is present.
process.env.QUIET_CORE_TEST_TRUST_BUNDLED_PLUGINS_DIR ??= "1";
// Vitest fork workers can load transitive lockfile helpers many times per worker.
// Raise listener budget to avoid noisy MaxListeners warnings and warning-stack overhead.
const TEST_PROCESS_MAX_LISTENERS = 256;
if (process.getMaxListeners() > 0 && process.getMaxListeners() < TEST_PROCESS_MAX_LISTENERS) {
  process.setMaxListeners(TEST_PROCESS_MAX_LISTENERS);
}

import { installProcessWarningFilter } from "../src/infra/warning-filter.js";
import { withIsolatedTestHome } from "./test-env.js";

type SharedTestSetupOptions = {
  loadProfileEnv?: boolean;
};

const SHARED_TEST_SETUP = Symbol.for("quiet-core-bot.sharedTestSetup");

type SharedTestSetupHandle = {
  cleanup: () => void;
  tempHome: string;
};

function isPathInsideDirectory(rootDir: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Vitest's default thread pool keeps `process.env` writes thread-local: they never reach the OS
 * environment block, so `os.homedir()` keeps returning the developer's real home inside a worker.
 * Any path helper that falls back to `os.homedir()` (instead of the injected env/homedir) would then
 * resolve the real state/config dirs mid-test. Pin it to the isolated temp home while it is active.
 */
function pinIsolatedOsHomedir(tempHome: string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(os, "homedir");
  const original = os.homedir;
  try {
    Object.defineProperty(os, "homedir", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      writable: true,
      value: () => tempHome,
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      Object.defineProperty(
        os,
        "homedir",
        descriptor ?? { configurable: true, enumerable: true, writable: true, value: original },
      );
    } catch {
      // Ignore restore failures during teardown.
    }
  };
}

/**
 * Fail fast instead of silently polluting the developer's real state when a lane forgets (or breaks)
 * shared test isolation. Re-resolves the app paths the way production does and requires every one of
 * them to live under the OS temp root.
 */
async function assertResolvedPathsStayInTempRoot(): Promise<void> {
  const tempRoot = os.tmpdir();
  const escaped: Array<[string, string]> = [];
  const check = (name: string, value: string | undefined): void => {
    if (value && !isPathInsideDirectory(tempRoot, value)) {
      escaped.push([name, value]);
    }
  };

  check("os.homedir()", os.homedir());
  // Best effort: suites may mock these modules, so a failed resolution is not itself a leak signal.
  try {
    const configPaths =
      await vi.importActual<typeof import("../src/config/paths.js")>("../src/config/paths.js");
    check("stateDir", configPaths.resolveStateDir());
    check("configPath", configPaths.resolveConfigPathCandidate());
  } catch {
    // Unresolvable in this suite (mocked module graph); the os.homedir() check above still applies.
  }
  try {
    const stateDbPaths = await vi.importActual<
      typeof import("../src/state/quiet-core-bot-state-db.paths.js")
    >("../src/state/quiet-core-bot-state-db.paths.js");
    check("stateSqlitePath", stateDbPaths.resolveOpenClawStateSqlitePath());
  } catch {
    // See above.
  }

  if (escaped.length === 0) {
    return;
  }
  throw new Error(
    [
      "[test-isolation] Resolved application paths escaped the test temp root.",
      `expected every path below: ${tempRoot}`,
      ...escaped.map(([name, value]) => `  - ${name}: ${value}`),
      "Fix this lane's setupFiles/env isolation (see test/setup.shared.ts) before rerunning tests.",
    ].join("\n"),
  );
}

export function installSharedTestSetup(options?: SharedTestSetupOptions): {
  cleanup: () => void;
  tempHome: string;
} {
  const globalState = globalThis as typeof globalThis & {
    [SHARED_TEST_SETUP]?: SharedTestSetupHandle;
  };
  const existing = globalState[SHARED_TEST_SETUP];
  if (existing) {
    return existing;
  }

  const realHomeBeforeIsolation = os.homedir();
  const testEnv = withIsolatedTestHome({
    loadProfileEnv: options?.loadProfileEnv,
  });
  const isolated =
    Boolean(testEnv.tempHome) &&
    path.resolve(testEnv.tempHome) !== path.resolve(realHomeBeforeIsolation);
  const restoreOsHomedir = isolated ? pinIsolatedOsHomedir(testEnv.tempHome) : () => {};
  if (isolated) {
    beforeAll(assertResolvedPathsStayInTempRoot);
  }
  installProcessWarningFilter();

  let cleaned = false;
  const handle: SharedTestSetupHandle = {
    tempHome: testEnv.tempHome,
    cleanup: () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      restoreOsHomedir();
      testEnv.cleanup();
      delete globalState[SHARED_TEST_SETUP];
    },
  };
  process.once("exit", handle.cleanup);
  globalState[SHARED_TEST_SETUP] = handle;
  return handle;
}
