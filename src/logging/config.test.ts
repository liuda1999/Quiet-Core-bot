// Logging config tests cover config file loading and defaults.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import { readLoggingConfig } from "./config.js";

const originalArgv = process.argv;
let tempDirs: string[] = [];

function writeConfig(source: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot-logging-config-"));
  tempDirs.push(dir);
  const configPath = path.join(dir, "quiet-core-bot.json");
  fs.writeFileSync(configPath, source);
  return configPath;
}

describe("readLoggingConfig", () => {
  afterEach(() => {
    process.argv = originalArgv;
    for (const dir of tempDirs) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
    tempDirs = [];
  });

  it("skips mutating config loads for config schema", () => {
    process.argv = ["node", "quiet-core-bot", "config", "schema"];
    const configPath = writeConfig(`{ logging: { file: "/tmp/should-not-read.log" } }`);
    fs.rmSync(configPath);

    withEnv({ QUIET_CORE_CONFIG_PATH: configPath }, () => {
      expect(readLoggingConfig()).toBeUndefined();
    });
  });

  it("reads logging config directly from the active config path", () => {
    const configPath = writeConfig(`{
      logging: {
        level: "debug",
        file: "/tmp/quiet-core-bot-custom.log",
        maxFileBytes: 1234,
      },
    }`);

    withEnv({ QUIET_CORE_CONFIG_PATH: configPath }, () => {
      expect(readLoggingConfig()).toStrictEqual({
        level: "debug",
        file: "/tmp/quiet-core-bot-custom.log",
        maxFileBytes: 1234,
      });
    });
  });

  it("supports JSON5 comments and trailing commas", () => {
    const configPath = writeConfig(`{
      // users commonly keep comments in quiet-core-bot.json
      logging: {
        consoleLevel: "warn",
      },
    }`);

    withEnv({ QUIET_CORE_CONFIG_PATH: configPath }, () => {
      expect(readLoggingConfig()).toStrictEqual({
        consoleLevel: "warn",
      });
    });
  });

  it("returns undefined for missing or malformed config files", () => {
    withEnv(
      { QUIET_CORE_CONFIG_PATH: path.join(os.tmpdir(), "quiet-core-bot-missing-config.json") },
      () => {
        expect(readLoggingConfig()).toBeUndefined();
      },
    );

    const configPath = writeConfig(`{ logging: `);
    withEnv({ QUIET_CORE_CONFIG_PATH: configPath }, () => {
      expect(readLoggingConfig()).toBeUndefined();
    });
  });
});
