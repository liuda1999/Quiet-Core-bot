import { createRequire } from "node:module";
// Verifies chat-facing CLI snippets execute the Quiet Core bot CLI even from harness-hosted gateways.
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildCurrentOpenClawCliArgv,
  buildCurrentOpenClawCliExecEnv,
} from "./commands-quiet-core-bot-cli.js";

const requireFromHere = createRequire(import.meta.url);
const originalArgv = [...process.argv];
const repoSourceEntry = path.join(process.cwd(), "src", "entry.ts");
const trustedTsxLoader = requireFromHere.resolve("tsx", { paths: [process.cwd()] });

function setArgv1(value: string): void {
  process.argv.splice(0, process.argv.length, process.execPath, value);
}

describe("buildCurrentOpenClawCliArgv", () => {
  afterEach(() => {
    process.argv.splice(0, process.argv.length, ...originalArgv);
  });

  it("falls back to the package CLI entry when hosted by a test harness", () => {
    setArgv1(path.join(process.cwd(), "scripts", "test-live.mjs"));

    expect(buildCurrentOpenClawCliArgv(["sessions", "export-trajectory"])).toEqual([
      process.execPath,
      "--import",
      trustedTsxLoader,
      repoSourceEntry,
      "sessions",
      "export-trajectory",
    ]);
  });

  it("preserves a real Quiet Core bot launcher entry", () => {
    setArgv1("/opt/quiet-core-bot/quiet-core-bot.mjs");

    expect(buildCurrentOpenClawCliArgv(["sessions", "export-trajectory"])).toEqual([
      process.execPath,
      ...process.execArgv,
      "/opt/quiet-core-bot/quiet-core-bot.mjs",
      "sessions",
      "export-trajectory",
    ]);
  });

  it("preserves Quiet Core bot dist entries from the package root", () => {
    const distEntry = path.join(process.cwd(), "dist", "entry.js");
    setArgv1(distEntry);

    expect(buildCurrentOpenClawCliArgv(["sessions", "export-trajectory"])).toEqual([
      process.execPath,
      ...process.execArgv,
      distEntry,
      "sessions",
      "export-trajectory",
    ]);
  });

  it("preserves Quiet Core bot source entries from the package root", () => {
    const sourceEntry = path.join(process.cwd(), "src", "entry.ts");
    setArgv1(sourceEntry);

    expect(buildCurrentOpenClawCliArgv(["sessions", "export-trajectory"])).toEqual([
      process.execPath,
      ...process.execArgv,
      sourceEntry,
      "sessions",
      "export-trajectory",
    ]);
  });

  it("does not treat foreign dist entries as Quiet Core bot launchers", () => {
    setArgv1("/app/dist/index.js");

    expect(buildCurrentOpenClawCliArgv(["sessions", "export-trajectory"])).toEqual([
      process.execPath,
      "--import",
      trustedTsxLoader,
      repoSourceEntry,
      "sessions",
      "export-trajectory",
    ]);
  });

  it("clears inherited Vitest runner environment for CLI child processes", () => {
    expect(
      buildCurrentOpenClawCliExecEnv({
        PATH: "/usr/bin",
        VITEST: "true",
        VITEST_POOL_ID: "pool",
        QUIET_CORE_VITEST_MAX_WORKERS: "1",
      }),
    ).toEqual({
      VITEST: "",
      VITEST_POOL_ID: "",
      QUIET_CORE_VITEST_MAX_WORKERS: "",
    });
  });
});
