// Covers Nix integration config compatibility scenarios U3, U5, and U9.
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveConfigPathCandidate,
  resolveGatewayPort,
  resolveIsNixMode,
  resolveStateDir,
} from "./config.js";
import { withTempHome } from "./test-helpers.js";

vi.unmock("../version.js");

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Hermetic env: don't inherit process.env because other tests may mutate it.
  return { ...overrides };
}

describe("Nix integration (U3, U5, U9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("U3: isNixMode env var detection", () => {
    it("isNixMode is false when QUIET_CORE_NIX_MODE is not set", () => {
      expect(resolveIsNixMode(envWith({ QUIET_CORE_NIX_MODE: undefined }))).toBe(false);
    });

    it("isNixMode is false when QUIET_CORE_NIX_MODE is empty", () => {
      expect(resolveIsNixMode(envWith({ QUIET_CORE_NIX_MODE: "" }))).toBe(false);
    });

    it("isNixMode is false when QUIET_CORE_NIX_MODE is not '1'", () => {
      expect(resolveIsNixMode(envWith({ QUIET_CORE_NIX_MODE: "true" }))).toBe(false);
    });

    it("isNixMode is true when QUIET_CORE_NIX_MODE=1", () => {
      expect(resolveIsNixMode(envWith({ QUIET_CORE_NIX_MODE: "1" }))).toBe(true);
    });
  });

  describe("U5: CONFIG_PATH and STATE_DIR env var overrides", () => {
    it("STATE_DIR defaults to ~/.quiet-core-bot when env not set", () => {
      expect(resolveStateDir(envWith({ QUIET_CORE_STATE_DIR: undefined }))).toMatch(
        /\.quiet-core-bot$/,
      );
    });

    it("STATE_DIR respects QUIET_CORE_STATE_DIR override", () => {
      expect(resolveStateDir(envWith({ QUIET_CORE_STATE_DIR: "/custom/state/dir" }))).toBe(
        path.resolve("/custom/state/dir"),
      );
    });

    it("STATE_DIR respects QUIET_CORE_HOME when state override is unset", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(envWith({ QUIET_CORE_HOME: customHome, QUIET_CORE_STATE_DIR: undefined })),
      ).toBe(path.join(path.resolve(customHome), ".quiet-core-bot"));
    });

    it("CONFIG_PATH defaults to QUIET_CORE_HOME/.quiet-core-bot/quiet-core-bot.json", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            QUIET_CORE_HOME: customHome,
            QUIET_CORE_CONFIG_PATH: undefined,
            QUIET_CORE_STATE_DIR: undefined,
          }),
        ),
      ).toBe(path.join(path.resolve(customHome), ".quiet-core-bot", "quiet-core-bot.json"));
    });

    it("CONFIG_PATH defaults to ~/.quiet-core-bot/quiet-core-bot.json when env not set", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ QUIET_CORE_CONFIG_PATH: undefined, QUIET_CORE_STATE_DIR: undefined }),
        ),
      ).toMatch(/\.quiet-core-bot[\\/]quiet-core-bot\.json$/);
    });

    it("CONFIG_PATH respects QUIET_CORE_CONFIG_PATH override", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ QUIET_CORE_CONFIG_PATH: "/nix/store/abc/quiet-core-bot.json" }),
        ),
      ).toBe(path.resolve("/nix/store/abc/quiet-core-bot.json"));
    });

    it("CONFIG_PATH expands ~ in QUIET_CORE_CONFIG_PATH override", async () => {
      await withTempHome(async (home) => {
        expect(
          resolveConfigPathCandidate(
            envWith({ QUIET_CORE_HOME: home, QUIET_CORE_CONFIG_PATH: "~/.quiet-core-bot/custom.json" }),
            () => home,
          ),
        ).toBe(path.join(home, ".quiet-core-bot", "custom.json"));
      });
    });

    it("CONFIG_PATH uses STATE_DIR when only state dir is overridden", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ QUIET_CORE_STATE_DIR: "/custom/state", QUIET_CORE_TEST_FAST: "1" }),
          () => path.join(path.sep, "tmp", "quiet-core-bot-config-home"),
        ),
      ).toBe(path.join(path.resolve("/custom/state"), "quiet-core-bot.json"));
    });
  });

  describe("U6: gateway port resolution", () => {
    it("uses default when env and config are unset", () => {
      expect(resolveGatewayPort({}, envWith({ QUIET_CORE_GATEWAY_PORT: undefined }))).toBe(
        DEFAULT_GATEWAY_PORT,
      );
    });

    it("prefers QUIET_CORE_GATEWAY_PORT over config", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19002 } },
          envWith({ QUIET_CORE_GATEWAY_PORT: "19001" }),
        ),
      ).toBe(19001);
    });

    it("falls back to config when env is invalid", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19003 } },
          envWith({ QUIET_CORE_GATEWAY_PORT: "nope" }),
        ),
      ).toBe(19003);
    });
  });
});
