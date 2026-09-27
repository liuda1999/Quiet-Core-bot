/**
 * Shared test harness for plugin SDK contract tests that need temp fixtures.
 */
import { mkdirSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll } from "vitest";
import { removeTestTempPath } from "../test-utils/session-state-cleanup.js";

/** Creates per-suite temp fixture helpers with automatic Vitest cleanup. */
export function createPluginSdkTestHarness() {
  let fixtureRoot = "";
  let caseId = 0;

  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), "quiet-core-bot-plugin-sdk-fixtures-"));
  });

  afterAll(async () => {
    if (!fixtureRoot) {
      return;
    }
    await removeTestTempPath(fixtureRoot);
  });

  function nextTempDir(prefix: string): string {
    return path.join(fixtureRoot, `${prefix}${caseId++}`);
  }

  async function createTempDir(prefix: string): Promise<string> {
    const dir = nextTempDir(prefix);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  function createTempDirSync(prefix: string): string {
    const dir = nextTempDir(prefix);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  return {
    createTempDir,
    createTempDirSync,
  };
}
