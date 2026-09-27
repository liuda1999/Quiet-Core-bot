// Tests shared utility helpers used by CLI and runtime modules.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import { withEnv } from "./test-utils/env.js";
import {
  CONFIG_DIR,
  ensureDir,
  pinConfigDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "quiet-core-bot-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.quiet-core-bot when legacy dir is missing", async () => {
    await withTempDir({ prefix: "quiet-core-bot-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".quiet-core-bot");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands QUIET_CORE_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/quiet-core-bot-home",
      QUIET_CORE_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/quiet-core-bot-home", "state"));
  });

  it("falls back to the config file directory when only QUIET_CORE_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/quiet-core-bot-home",
      QUIET_CORE_CONFIG_PATH: "~/profiles/dev/quiet-core-bot.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/quiet-core-bot-home", "profiles", "dev"));
  });

  it("re-pins the exported configuration root after startup environment selection", () => {
    const originalConfigDir = CONFIG_DIR;
    const selectedConfigDir = path.resolve("/tmp/quiet-core-bot-selected-config-root");
    try {
      expect(
        pinConfigDir({
          QUIET_CORE_STATE_DIR: selectedConfigDir,
          QUIET_CORE_TEST_FAST: "1",
        }),
      ).toBe(selectedConfigDir);
      expect(CONFIG_DIR).toBe(selectedConfigDir);
    } finally {
      pinConfigDir({
        QUIET_CORE_STATE_DIR: originalConfigDir,
        QUIET_CORE_TEST_FAST: "1",
      });
    }
  });
});

describe("resolveHomeDir", () => {
  it("prefers QUIET_CORE_HOME over HOME", () => {
    withEnv({ QUIET_CORE_HOME: "/srv/quiet-core-bot-home", HOME: "/home/other" }, () => {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/quiet-core-bot-home"));
    });
  });
});

describe("shortenHomePath", () => {
  it("uses $QUIET_CORE_HOME prefix when QUIET_CORE_HOME is set", () => {
    withEnv({ QUIET_CORE_HOME: "/srv/quiet-core-bot-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomePath(`${path.resolve("/srv/quiet-core-bot-home")}/.quiet-core-bot/quiet-core-bot.json`),
      ).toBe("$QUIET_CORE_HOME/.quiet-core-bot/quiet-core-bot.json");
    });
  });
});

describe("shortenHomeInString", () => {
  it("uses $QUIET_CORE_HOME replacement when QUIET_CORE_HOME is set", () => {
    withEnv({ QUIET_CORE_HOME: "/srv/quiet-core-bot-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/quiet-core-bot-home")}/.quiet-core-bot/quiet-core-bot.json`,
        ),
      ).toBe("config: $QUIET_CORE_HOME/.quiet-core-bot/quiet-core-bot.json");
    });
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/quiet-core-bot", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "quiet-core-bot"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers QUIET_CORE_HOME for tilde expansion", () => {
    withEnv({ QUIET_CORE_HOME: "/srv/quiet-core-bot-home", HOME: "/home/other" }, () => {
      expect(resolveUserPath("~/quiet-core-bot")).toBe(path.resolve("/srv/quiet-core-bot-home", "quiet-core-bot"));
    });
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/quiet-core-bot-home",
      QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/quiet-core-bot", env)).toBe(path.resolve("/srv/quiet-core-bot-home", "quiet-core-bot"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
