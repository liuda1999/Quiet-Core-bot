// Plugins CLI policy tests cover plugin command policy checks and warnings.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import {
  buildPluginRegistrySnapshotReport,
  enablePluginInConfig,
  loadConfig,
  refreshPluginRegistry,
  resetPluginsCliTestState,
  runtimeErrors,
  runPluginsCommand,
  writeConfigFile,
} from "./plugins-cli-test-helpers.js";

const ORIGINAL_QUIET_CORE_NIX_MODE = process.env.QUIET_CORE_NIX_MODE;

describe("plugins cli policy mutations", () => {
  const compatibilityPluginIds = [
    { alias: "google-gemini-cli", pluginId: "google" },
    { alias: "minimax-portal-auth", pluginId: "minimax" },
  ] as const;

  beforeEach(() => {
    resetPluginsCliTestState();
  });

  afterEach(() => {
    if (ORIGINAL_QUIET_CORE_NIX_MODE === undefined) {
      delete process.env.QUIET_CORE_NIX_MODE;
    } else {
      process.env.QUIET_CORE_NIX_MODE = ORIGINAL_QUIET_CORE_NIX_MODE;
    }
  });

  function mockPluginRegistry(ids: string[]) {
    buildPluginRegistrySnapshotReport.mockReturnValue({
      plugins: ids.map((id) => ({ id })),
      diagnostics: [],
      registrySource: "derived",
      registryDiagnostics: [],
    });
  }

  function requireFirstWrittenConfig(): QuietCoreConfig {
    const call = writeConfigFile.mock.calls[0];
    if (!call) {
      throw new Error("expected writeConfigFile to be called");
    }
    const [config] = call;
    if (!config) {
      throw new Error("expected writeConfigFile to receive a config");
    }
    return config;
  }

  function requirePluginEntries(
    config: QuietCoreConfig,
  ): NonNullable<NonNullable<QuietCoreConfig["plugins"]>["entries"]> {
    if (!config.plugins?.entries) {
      throw new Error("expected plugin entries in config");
    }
    return config.plugins.entries;
  }

  it("refreshes the persisted plugin registry after enabling a plugin", async () => {
    const sourceConfig = {} as QuietCoreConfig;
    const enabledConfig = {
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
      },
    } as QuietCoreConfig;
    loadConfig.mockReturnValue(sourceConfig);
    enablePluginInConfig.mockReturnValue({
      config: enabledConfig,
      enabled: true,
      pluginId: "alpha",
    });
    mockPluginRegistry(["alpha"]);

    await runPluginsCommand(["plugins", "enable", "alpha"]);

    expect(enablePluginInConfig).toHaveBeenCalledWith(sourceConfig, "alpha", {
      updateChannelConfig: false,
    });
    expect(writeConfigFile).toHaveBeenCalledWith(enabledConfig);
    expect(refreshPluginRegistry).toHaveBeenCalledWith({
      config: enabledConfig,
      installRecords: {},
      policyPluginIds: ["alpha"],
      reason: "policy-changed",
    });
  });

  it("refuses plugin enablement in Nix mode before config mutation", async () => {
    const previous = process.env.QUIET_CORE_NIX_MODE;
    process.env.QUIET_CORE_NIX_MODE = "1";
    try {
      await expect(runPluginsCommand(["plugins", "enable", "alpha"])).rejects.toThrow(
        "QUIET_CORE_NIX_MODE=1",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.QUIET_CORE_NIX_MODE;
      } else {
        process.env.QUIET_CORE_NIX_MODE = previous;
      }
    }

    expect(enablePluginInConfig).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it("refreshes the persisted plugin registry after disabling a plugin", async () => {
    loadConfig.mockReturnValue({
      plugins: {
        entries: {
          alpha: { enabled: true },
        },
      },
    } as QuietCoreConfig);
    mockPluginRegistry(["alpha"]);

    await runPluginsCommand(["plugins", "disable", "alpha"]);

    const nextConfig = requireFirstWrittenConfig();
    const entries = requirePluginEntries(nextConfig);
    expect(entries.alpha).toEqual({ enabled: false });
    expect(refreshPluginRegistry).toHaveBeenCalledWith({
      config: nextConfig,
      installRecords: {},
      policyPluginIds: ["alpha"],
      reason: "policy-changed",
    });
  });

  it.each(compatibilityPluginIds)(
    "enables compatibility id $alias through canonical plugin $pluginId",
    async ({ alias, pluginId }) => {
      const sourceConfig = {} as QuietCoreConfig;
      const enabledConfig = {
        plugins: {
          entries: {
            [pluginId]: { enabled: true },
          },
        },
      } as QuietCoreConfig;
      loadConfig.mockReturnValue(sourceConfig);
      enablePluginInConfig.mockReturnValue({
        config: enabledConfig,
        enabled: true,
      });
      mockPluginRegistry([pluginId]);

      await runPluginsCommand(["plugins", "enable", alias]);

      expect(enablePluginInConfig).toHaveBeenCalledWith(sourceConfig, pluginId, {
        updateChannelConfig: false,
      });
      expect(writeConfigFile).toHaveBeenCalledWith(enabledConfig);
    },
  );

  it.each(compatibilityPluginIds)(
    "disables compatibility id $alias through canonical plugin $pluginId",
    async ({ alias, pluginId }) => {
      loadConfig.mockReturnValue({
        plugins: {
          entries: {
            [pluginId]: { enabled: true },
          },
        },
      } as QuietCoreConfig);
      mockPluginRegistry([pluginId]);

      await runPluginsCommand(["plugins", "disable", alias]);

      const nextConfig = requireFirstWrittenConfig();
      const entries = requirePluginEntries(nextConfig);
      expect(entries[pluginId]).toEqual({ enabled: false });
      expect(entries[alias]).toBeUndefined();
    },
  );

  it.each(["enable", "disable"] as const)(
    "rejects %s for a plugin that is not discovered",
    async (command) => {
      mockPluginRegistry(["alpha"]);

      await expect(runPluginsCommand(["plugins", command, "missing-plugin"])).rejects.toThrow(
        "__exit__:1",
      );

      expect(runtimeErrors).toContain(
        "Plugin not found: missing-plugin. Run `quiet-core-bot plugins list` to see installed plugins, or `quiet-core-bot plugins search missing-plugin` to look for installable plugins.",
      );
      expect(enablePluginInConfig).not.toHaveBeenCalled();
      expect(writeConfigFile).not.toHaveBeenCalled();
      expect(refreshPluginRegistry).not.toHaveBeenCalled();
    },
  );

  it("does not create a channel config when disabling a channel plugin by policy", async () => {
    loadConfig.mockReturnValue({} as QuietCoreConfig);
    mockPluginRegistry(["twitch"]);

    await runPluginsCommand(["plugins", "disable", "twitch"]);

    const nextConfig = requireFirstWrittenConfig();
    const entries = requirePluginEntries(nextConfig);
    expect(entries.twitch).toEqual({ enabled: false });
    expect(nextConfig.channels?.twitch).toBeUndefined();
  });
});
