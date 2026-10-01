// Covers config path resolution across env, home, and agent roots.
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../test-helpers/temp-dir.js";
import {
  CONFIG_PATH,
  DEFAULT_GATEWAY_PORT,
  isNixMode,
  normalizeStateDirEnv,
  pinRuntimePaths,
  resolveDefaultConfigCandidates,
  resolveConfigPathCandidate,
  resolveConfigPath,
  resolveGatewayPort,
  resolveIncludeRoots,
  resolveOAuthDir,
  resolveOAuthPath,
  resolveStateDir,
  STATE_DIR,
} from "./paths.js";

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides };
}

describe("oauth paths", () => {
  it("prefers QUIET_CORE_OAUTH_DIR over QUIET_CORE_STATE_DIR", () => {
    const env = {
      QUIET_CORE_OAUTH_DIR: "/custom/oauth",
      QUIET_CORE_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.resolve("/custom/oauth"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join(path.resolve("/custom/oauth"), "oauth.json"),
    );
  });

  it("derives oauth path from QUIET_CORE_STATE_DIR when unset", () => {
    const env = {
      QUIET_CORE_STATE_DIR: "/custom/state",
    } as NodeJS.ProcessEnv;

    expect(resolveOAuthDir(env, "/custom/state")).toBe(path.join("/custom/state", "credentials"));
    expect(resolveOAuthPath(env, "/custom/state")).toBe(
      path.join("/custom/state", "credentials", "oauth.json"),
    );
  });
});

describe("gateway port resolution", () => {
  it("prefers numeric env values over config", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19002 } }, envWith({ QUIET_CORE_GATEWAY_PORT: "19001" })),
    ).toBe(19001);
  });

  it("accepts Compose-style IPv4 host publish values from env", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ QUIET_CORE_GATEWAY_PORT: "127.0.0.1:18789" }),
      ),
    ).toBe(18789);
  });

  it("accepts Compose-style IPv6 host publish values from env", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ QUIET_CORE_GATEWAY_PORT: "[::1]:28789" }),
      ),
    ).toBe(28789);
  });

  it("ignores the legacy env name and falls back to config", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19002 } },
        envWith({ CLAWDBOT_GATEWAY_PORT: "127.0.0.1:18789" }),
      ),
    ).toBe(19002);
  });

  it("falls back to config when the Compose-style suffix is invalid", () => {
    expect(
      resolveGatewayPort(
        { gateway: { port: 19003 } },
        envWith({ QUIET_CORE_GATEWAY_PORT: "127.0.0.1:not-a-port" }),
      ),
    ).toBe(19003);
  });

  it("falls back to config when env ports exceed TCP bounds", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19003 } }, envWith({ QUIET_CORE_GATEWAY_PORT: "65536" })),
    ).toBe(19003);
    expect(
      resolveGatewayPort(
        { gateway: { port: 19004 } },
        envWith({ QUIET_CORE_GATEWAY_PORT: "127.0.0.1:65536" }),
      ),
    ).toBe(19004);
    expect(
      resolveGatewayPort(
        { gateway: { port: 19005 } },
        envWith({ QUIET_CORE_GATEWAY_PORT: "[::1]:65536" }),
      ),
    ).toBe(19005);
  });

  it("falls back when malformed IPv6 inputs do not provide an explicit port", () => {
    expect(
      resolveGatewayPort({ gateway: { port: 19003 } }, envWith({ QUIET_CORE_GATEWAY_PORT: "::1" })),
    ).toBe(19003);
    expect(resolveGatewayPort({}, envWith({ QUIET_CORE_GATEWAY_PORT: "2001:db8::1" }))).toBe(
      DEFAULT_GATEWAY_PORT,
    );
  });

  it("falls back to the default port when env is invalid and config is unset", () => {
    expect(resolveGatewayPort({}, envWith({ QUIET_CORE_GATEWAY_PORT: "127.0.0.1:not-a-port" }))).toBe(
      DEFAULT_GATEWAY_PORT,
    );
  });
});

describe("state + config path candidates", () => {
  function expectQuietCoreHomeDefaults(env: NodeJS.ProcessEnv): void {
    const configuredHome = env.QUIET_CORE_HOME;
    if (!configuredHome) {
      throw new Error("QUIET_CORE_HOME must be set for this assertion helper");
    }
    const resolvedHome = path.resolve(configuredHome);
    expect(resolveStateDir(env)).toBe(path.join(resolvedHome, ".quiet-core-bot"));

    const candidates = resolveDefaultConfigCandidates(env);
    expect(candidates[0]).toBe(path.join(resolvedHome, ".quiet-core-bot", "quiet-core-bot.json"));
  }

  it("uses QUIET_CORE_STATE_DIR when set", () => {
    const env = {
      QUIET_CORE_STATE_DIR: "/new/state",
    } as NodeJS.ProcessEnv;

    expect(resolveStateDir(env, () => "/home/test")).toBe(path.resolve("/new/state"));
  });

  it("normalizes relative QUIET_CORE_STATE_DIR overrides to absolute paths", () => {
    const env = {
      QUIET_CORE_STATE_DIR: ".",
      QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
    } as NodeJS.ProcessEnv;

    normalizeStateDirEnv(env);

    expect(env.QUIET_CORE_STATE_DIR).toBe(path.resolve("."));
  });

  it("pins a relative state-dir override before later resolution", () => {
    const env = {
      QUIET_CORE_STATE_DIR: "relative-state",
      QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
    } as NodeJS.ProcessEnv;

    normalizeStateDirEnv(env);
    const normalized = env.QUIET_CORE_STATE_DIR;

    expect(normalized).toBe(path.resolve("relative-state"));
    expect(resolveStateDir(env, () => "/srv/other-home")).toBe(normalized);
  });

  it("re-pins exported runtime paths after startup environment selection", () => {
    const originalConfigPath = CONFIG_PATH;
    const originalNixMode = isNixMode;
    const originalStateDir = STATE_DIR;
    const selectedStateDir = path.resolve("/tmp/quiet-core-bot-selected-runtime-state");
    const selectedConfigPath = path.join(selectedStateDir, "selected.json");
    try {
      const pinned = pinRuntimePaths({
        QUIET_CORE_CONFIG_PATH: selectedConfigPath,
        QUIET_CORE_NIX_MODE: "1",
        QUIET_CORE_STATE_DIR: selectedStateDir,
        QUIET_CORE_TEST_FAST: "1",
      });

      expect(pinned).toEqual({
        configPath: selectedConfigPath,
        stateDir: selectedStateDir,
      });
      expect(CONFIG_PATH).toBe(selectedConfigPath);
      expect(isNixMode).toBe(true);
      expect(STATE_DIR).toBe(selectedStateDir);
    } finally {
      pinRuntimePaths({
        QUIET_CORE_CONFIG_PATH: originalConfigPath,
        QUIET_CORE_NIX_MODE: originalNixMode ? "1" : undefined,
        QUIET_CORE_STATE_DIR: originalStateDir,
        QUIET_CORE_TEST_FAST: "1",
      });
    }
  });

  it("uses QUIET_CORE_HOME for default state/config locations", () => {
    const env = {
      QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
    } as NodeJS.ProcessEnv;
    expectQuietCoreHomeDefaults(env);
  });

  it("prefers QUIET_CORE_HOME over HOME for default state/config locations", () => {
    const env = {
      QUIET_CORE_HOME: "/srv/quiet-core-bot-home",
      HOME: "/home/other",
    } as NodeJS.ProcessEnv;
    expectQuietCoreHomeDefaults(env);
  });

  it("returns only the new-brand config candidate", () => {
    const home = "/home/test";
    const resolvedHome = path.resolve(home);
    const candidates = resolveDefaultConfigCandidates({} as NodeJS.ProcessEnv, () => home);
    expect(candidates).toEqual([
      path.join(resolvedHome, ".quiet-core-bot", "quiet-core-bot.json"),
    ]);
  });

  it("prefers ~/.quiet-core-bot for the default state dir", async () => {
    await withTempDir({ prefix: "quiet-core-bot-state-" }, async (root) => {
      const newDir = path.join(root, ".quiet-core-bot");
      await fs.mkdir(newDir, { recursive: true });
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("uses the new state dir for a fresh install when nothing exists yet", async () => {
    await withTempDir({ prefix: "quiet-core-bot-state-fresh-" }, async (root) => {
      const resolved = resolveStateDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(path.join(root, ".quiet-core-bot"));
    });
  });

  it("CONFIG_PATH prefers existing config when present", async () => {
    await withTempDir({ prefix: "quiet-core-bot-config-" }, async (root) => {
      const newDir = path.join(root, ".quiet-core-bot");
      await fs.mkdir(newDir, { recursive: true });
      const newPath = path.join(newDir, "quiet-core-bot.json");
      await fs.writeFile(newPath, "{}", "utf-8");

      const resolved = resolveConfigPathCandidate({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newPath);
    });
  });

  it("respects state dir overrides when config is missing", async () => {
    await withTempDir({ prefix: "quiet-core-bot-config-override-" }, async (root) => {
      const overrideDir = path.join(root, "override");
      const env = { QUIET_CORE_STATE_DIR: overrideDir } as NodeJS.ProcessEnv;
      const resolved = resolveConfigPath(env, overrideDir, () => root);
      expect(resolved).toBe(path.join(overrideDir, "quiet-core-bot.json"));
    });
  });
});

describe("resolveIncludeRoots", () => {
  const HOME = path.parse(process.cwd()).root + "fakehome";

  it("returns an empty list when QUIET_CORE_INCLUDE_ROOTS is unset or blank", () => {
    expect(resolveIncludeRoots(envWith({}), () => HOME)).toStrictEqual([]);
    expect(resolveIncludeRoots(envWith({ QUIET_CORE_INCLUDE_ROOTS: "" }), () => HOME)).toStrictEqual(
      [],
    );
    expect(
      resolveIncludeRoots(envWith({ QUIET_CORE_INCLUDE_ROOTS: "   " }), () => HOME),
    ).toStrictEqual([]);
  });

  it("splits on the platform path delimiter and resolves each entry to an absolute path", () => {
    const a = path.resolve(path.parse(process.cwd()).root, "shared", "a");
    const b = path.resolve(path.parse(process.cwd()).root, "shared", "b");
    const env = envWith({ QUIET_CORE_INCLUDE_ROOTS: [a, b].join(path.delimiter) });
    expect(resolveIncludeRoots(env, () => HOME)).toEqual([a, b]);
  });

  it("expands a leading tilde in each entry using the resolved home dir", () => {
    const env = envWith({ QUIET_CORE_INCLUDE_ROOTS: "~/share/quiet-core-bot" });
    expect(resolveIncludeRoots(env, () => HOME)).toEqual([path.join(HOME, "share", "quiet-core-bot")]);
  });

  it("drops empty entries and preserves de-duplicated order for repeated roots", () => {
    const a = path.resolve(path.parse(process.cwd()).root, "shared", "a");
    const env = envWith({
      QUIET_CORE_INCLUDE_ROOTS: ["", a, "  ", a].join(path.delimiter),
    });
    expect(resolveIncludeRoots(env, () => HOME)).toEqual([a]);
  });
});
