// Verifies config IO compatibility loading and migration behavior.
import fs from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { normalizeCompatibilityConfigValues } from "../commands/doctor/shared/legacy-config-core-migrate.js";
import { VERSION } from "../version.js";
import { createConfigIO } from "./io.js";
import { normalizeExecSafeBinProfilesInConfig } from "./normalize-exec-safe-bin.js";
import { withTempHome } from "./test-helpers.js";
import type { QuietCoreConfig } from "./types.quiet-core-bot.js";

async function writeConfig(
  home: string,
  dirname: ".quiet-core-bot",
  port: number,
  filename = "quiet-core-bot.json",
) {
  const dir = path.join(home, dirname);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, filename);
  await fs.writeFile(configPath, JSON.stringify({ gateway: { port } }, null, 2));
  return configPath;
}

function createIoForHome(home: string, env: NodeJS.ProcessEnv = {} as NodeJS.ProcessEnv) {
  return createConfigIO({
    env: { HOME: home, ...env },
    homedir: () => home,
  });
}

describe("config io paths", () => {
  let whatsappSharedAccessDefaults: unknown;

  beforeAll(() => {
    const migrated = normalizeCompatibilityConfigValues({
      channels: {
        whatsapp: {
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom: ["+15550001111"],
          groupPolicy: "open",
          groupAllowFrom: [],
          accounts: {
            work: {
              enabled: true,
              authDir: "/tmp/wa-work",
            },
          },
        },
      },
    } as QuietCoreConfig);
    whatsappSharedAccessDefaults = migrated.config.channels?.whatsapp?.accounts?.default;
  });

  it("uses ~/.quiet-core-bot/quiet-core-bot.json when config exists", async () => {
    await withTempHome(async (home) => {
      const configPath = await writeConfig(home, ".quiet-core-bot", 19001);
      const io = createIoForHome(home);
      expect(io.configPath).toBe(configPath);
    });
  });

  it("defaults to ~/.quiet-core-bot/quiet-core-bot.json when config is missing", async () => {
    await withTempHome(async (home) => {
      const io = createIoForHome(home);
      expect(io.configPath).toBe(path.join(home, ".quiet-core-bot", "quiet-core-bot.json"));
    });
  });

  it("uses QUIET_CORE_HOME for default config path", async () => {
    await withTempHome(async (home) => {
      const io = createConfigIO({
        env: { QUIET_CORE_HOME: path.join(home, "svc-home") } as NodeJS.ProcessEnv,
        homedir: () => path.join(home, "ignored-home"),
      });
      expect(io.configPath).toBe(
        path.join(home, "svc-home", ".quiet-core-bot", "quiet-core-bot.json"),
      );
    });
  });

  it("honors explicit QUIET_CORE_CONFIG_PATH override", async () => {
    await withTempHome(async (home) => {
      const customPath = await writeConfig(home, ".quiet-core-bot", 20002, "custom.json");
      const io = createIoForHome(home, { QUIET_CORE_CONFIG_PATH: customPath } as NodeJS.ProcessEnv);
      expect(io.configPath).toBe(customPath);
    });
  });

  it("logs validation warnings with real line breaks", async () => {
    await withTempHome(async (home) => {
      const configPath = path.join(home, ".quiet-core-bot", "quiet-core-bot.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            plugins: {
              entries: {
                "google-antigravity-auth": {
                  enabled: false,
                  config: { stale: true },
                },
              },
            },
          },
          null,
          2,
        ),
      );
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
      };

      const io = createConfigIO({
        configPath,
        env: { HOME: home } as NodeJS.ProcessEnv,
        homedir: () => home,
        logger,
      });
      io.loadConfig();

      expect(logger.warn).toHaveBeenCalledWith(
        "Config warnings:\n- plugins.entries.google-antigravity-auth: plugin removed: google-antigravity-auth (stale config entry ignored; remove it from plugins config)",
      );
      expect(logger.warn).not.toHaveBeenCalledWith("Config warnings:\\n");
    });
  });

  it("explains what to check when config was written by a newer Quiet Core bot", async () => {
    await withTempHome(async (home) => {
      const configPath = path.join(home, ".quiet-core-bot", "quiet-core-bot.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
          null,
          2,
        ),
      );
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
      };

      const io = createConfigIO({
        configPath,
        env: { HOME: home } as NodeJS.ProcessEnv,
        homedir: () => home,
        logger,
      });
      io.loadConfig();

      expect(logger.warn).toHaveBeenCalledWith(
        [
          `Your Quiet Core bot config was written by version 9999.1.1, but this command is running ${VERSION}.`,
          "Check: `quiet-core-bot --version`, `which quiet-core-bot`, and `quiet-core-bot gateway status --deep`.",
          "If unexpected, update PATH so `quiet-core-bot` points to the version you want, or reinstall the Gateway service from that same Quiet Core bot install.",
        ].join("\n"),
      );
    });
  });

  it("does not warn about newer config during internal update handoff reads", async () => {
    await withTempHome(async (home) => {
      const configPath = path.join(home, ".quiet-core-bot", "quiet-core-bot.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
          null,
          2,
        ),
      );
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
      };

      const io = createConfigIO({
        configPath,
        env: { HOME: home, QUIET_CORE_UPDATE_POST_CORE: "1" } as NodeJS.ProcessEnv,
        homedir: () => home,
        logger,
      });
      io.loadConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  it("normalizes safe-bin config entries at config load time", () => {
    const cfg = {
      tools: {
        exec: {
          safeBinTrustedDirs: [" /custom/bin ", "", "/custom/bin", "/agent/bin"],
          safeBinProfiles: {
            " MyFilter ": {
              allowedValueFlags: ["--limit", " --limit ", ""],
            },
          },
        },
      },
      agents: {
        list: [
          {
            id: "ops",
            tools: {
              exec: {
                safeBinTrustedDirs: [" /ops/bin ", "/ops/bin"],
                safeBinProfiles: {
                  " Custom ": {
                    deniedFlags: ["-f", " -f ", ""],
                  },
                },
              },
            },
          },
        ],
      },
    };
    normalizeExecSafeBinProfilesInConfig(cfg);
    expect(cfg.tools?.exec?.safeBinProfiles).toEqual({
      myfilter: {
        allowedValueFlags: ["--limit"],
      },
    });
    expect(cfg.tools?.exec?.safeBinTrustedDirs).toEqual(["/custom/bin", "/agent/bin"]);
    expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinProfiles).toEqual({
      custom: {
        deniedFlags: ["-f"],
      },
    });
    expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinTrustedDirs).toEqual(["/ops/bin"]);
  });

  it("moves WhatsApp shared access defaults into accounts.default during runtime compat", () => {
    expect(whatsappSharedAccessDefaults).toEqual({
      dmPolicy: "allowlist",
      allowFrom: ["+15550001111"],
      groupPolicy: "open",
      groupAllowFrom: [],
    });
  });
});
