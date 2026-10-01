// Tests isolated Quiet Core bot test-state setup and cleanup behavior.
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPersistedAuthProfileStore } from "../agents/auth-profiles/persisted.js";
import { closeQuietCoreAgentDatabasesForTest } from "../state/quiet-core-bot-agent-db.js";
import { withEnvAsync } from "./env.js";
import { createQuietCoreTestState, withQuietCoreTestState } from "./quiet-core-bot-test-state.js";

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.stat(targetPath);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    return;
  }
  throw new Error(`expected missing path: ${targetPath}`);
}

describe("quiet-core-bot test state", () => {
  it("creates an isolated home layout with spawn env and restores process env", async () => {
    const previousHome = process.env.HOME;
    const previousQuietCoreHome = process.env.QUIET_CORE_HOME;
    const previousStateDir = process.env.QUIET_CORE_STATE_DIR;
    const previousConfigPath = process.env.QUIET_CORE_CONFIG_PATH;

    const state = await createQuietCoreTestState({
      label: "unit",
      scenario: "minimal",
    });

    try {
      expect(state.home).toBe(path.join(state.root, "home"));
      expect(state.stateDir).toBe(path.join(state.home, ".quiet-core-bot"));
      expect(state.configPath).toBe(path.join(state.stateDir, "quiet-core-bot.json"));
      expect(state.workspaceDir).toBe(path.join(state.home, "workspace"));
      expect(state.env.HOME).toBe(state.home);
      expect(state.env.QUIET_CORE_HOME).toBe(state.home);
      expect(state.env.QUIET_CORE_STATE_DIR).toBe(state.stateDir);
      expect(state.env.QUIET_CORE_CONFIG_PATH).toBe(state.configPath);
      expect(process.env.HOME).toBe(state.home);
      expect(process.env.QUIET_CORE_HOME).toBe(state.home);
      expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toStrictEqual({});
    } finally {
      await state.cleanup();
    }

    expect(process.env.HOME).toBe(previousHome);
    expect(process.env.QUIET_CORE_HOME).toBe(previousQuietCoreHome);
    expect(process.env.QUIET_CORE_STATE_DIR).toBe(previousStateDir);
    expect(process.env.QUIET_CORE_CONFIG_PATH).toBe(previousConfigPath);
    await expectPathMissing(state.root);
  });

  it("supports state-only layout without overriding HOME", async () => {
    const previousHome = process.env.HOME;

    await withQuietCoreTestState(
      {
        layout: "state-only",
        scenario: "empty",
      },
      async (state) => {
        expect(process.env.HOME).toBe(previousHome);
        expect(process.env.QUIET_CORE_STATE_DIR).toBe(state.stateDir);
        expect(process.env.QUIET_CORE_CONFIG_PATH).toBe(state.configPath);
        expect(state.env.HOME).toBe(previousHome);
        await expectPathMissing(state.configPath);
      },
    );
  });

  it("clears inherited agent-dir overrides by default", async () => {
    await withEnvAsync({ QUIET_CORE_AGENT_DIR: "/tmp/outside-quiet-core-bot-agent" }, async () => {
      const state = await createQuietCoreTestState({
        layout: "state-only",
      });

      try {
        expect(process.env.QUIET_CORE_AGENT_DIR).toBeUndefined();
        expect(state.env.QUIET_CORE_AGENT_DIR).toBeUndefined();
        expect(state.agentDir()).toBe(path.join(state.stateDir, "agents", "main", "agent"));
      } finally {
        await state.cleanup();
      }

      expect(process.env.QUIET_CORE_AGENT_DIR).toBe("/tmp/outside-quiet-core-bot-agent");
    });
  });

  it("allows explicit agent-dir overrides when a test needs them", async () => {
    await withQuietCoreTestState(
      {
        env: {
          QUIET_CORE_AGENT_DIR: "/tmp/explicit-quiet-core-bot-agent",
        },
      },
      async (state) => {
        expect(process.env.QUIET_CORE_AGENT_DIR).toBe("/tmp/explicit-quiet-core-bot-agent");
        expect(state.env.QUIET_CORE_AGENT_DIR).toBe("/tmp/explicit-quiet-core-bot-agent");
      },
    );
  });

  it("can route agent-dir env vars to the isolated main agent store", async () => {
    await withQuietCoreTestState(
      {
        agentEnv: "main",
      },
      async (state) => {
        expect(process.env.QUIET_CORE_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.QUIET_CORE_AGENT_DIR).toBe(state.agentDir());
      },
    );
  });

  it("writes scenario configs and auth profile stores", async () => {
    await withQuietCoreTestState(
      {
        scenario: "update-stable",
      },
      async (state) => {
        try {
          expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toEqual({
            update: {
              channel: "stable",
            },
            plugins: {},
          });

          const profilePath = await state.writeAuthProfiles({
            version: 1,
            profiles: {
              "openai:test": {
                type: "api_key",
                provider: "openai",
                key: "sk-test",
              },
            },
          });

          expect(profilePath).toBe(path.join(state.agentDir(), "quiet-core-bot-agent.sqlite"));
          const profiles = loadPersistedAuthProfileStore(state.agentDir());
          expect(profiles?.version).toBe(1);
          expect(profiles?.profiles["openai:test"]?.provider).toBe("openai");
        } finally {
          // Release the cached agent SQLite handles so Windows can delete the
          // temp root (the open -wal/-shm files otherwise report EBUSY).
          closeQuietCoreAgentDatabasesForTest();
        }
      },
    );
  });

  it("creates upgrade survivor fixture state", async () => {
    await withQuietCoreTestState(
      {
        scenario: "upgrade-survivor",
      },
      async (state) => {
        const config = JSON.parse(await fs.readFile(state.configPath, "utf8"));
        expect(config.update?.channel).toBe("stable");
        expect(config.plugins?.enabled).toBe(true);
        expect(config.plugins?.allow).toStrictEqual(["discord", "telegram", "whatsapp", "memory"]);
      },
    );
  });

  it("keeps external-service env scoped to the fixture", async () => {
    const previousPolicy = process.env.QUIET_CORE_SERVICE_REPAIR_POLICY;

    await withQuietCoreTestState(
      {
        scenario: "external-service",
      },
      async (state) => {
        expect(process.env.QUIET_CORE_SERVICE_REPAIR_POLICY).toBe("external");
        expect(state.env.QUIET_CORE_SERVICE_REPAIR_POLICY).toBe("external");
      },
    );

    expect(process.env.QUIET_CORE_SERVICE_REPAIR_POLICY).toBe(previousPolicy);
  });
});
