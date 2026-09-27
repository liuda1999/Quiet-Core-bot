// Plugin update selection tests cover CLI plugin update target selection.
import { describe, expect, it } from "vitest";
import type { PluginInstallRecord } from "../config/types.plugins.js";
import { resolvePluginUpdateSelection } from "./plugins-update-selection.js";

function createNpmInstall(params: {
  spec: string;
  installPath?: string;
  resolvedName?: string;
}): PluginInstallRecord {
  return {
    source: "npm",
    spec: params.spec,
    installPath: params.installPath ?? "/tmp/plugin",
    ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
  };
}

describe("resolvePluginUpdateSelection", () => {
  it("maps an explicit unscoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "quiet-core-bot-codex-app-server": createNpmInstall({
            spec: "quiet-core-bot-codex-app-server",
            installPath: "/tmp/quiet-core-bot-codex-app-server",
            resolvedName: "quiet-core-bot-codex-app-server",
          }),
        },
        rawId: "quiet-core-bot-codex-app-server@beta",
      }),
    ).toEqual({
      pluginIds: ["quiet-core-bot-codex-app-server"],
      specOverrides: {
        "quiet-core-bot-codex-app-server": "quiet-core-bot-codex-app-server@beta",
      },
    });
  });

  it("maps an explicit scoped npm dist-tag update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "voice-call": createNpmInstall({
            spec: "@quiet-core/voice-call",
            installPath: "/tmp/voice-call",
            resolvedName: "@quiet-core/voice-call",
          }),
        },
        rawId: "@quiet-core/voice-call@beta",
      }),
    ).toEqual({
      pluginIds: ["voice-call"],
      specOverrides: {
        "voice-call": "@quiet-core/voice-call@beta",
      },
    });
  });

  it("maps an explicit npm version update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "quiet-core-bot-codex-app-server": createNpmInstall({
            spec: "quiet-core-bot-codex-app-server",
            installPath: "/tmp/quiet-core-bot-codex-app-server",
            resolvedName: "quiet-core-bot-codex-app-server",
          }),
        },
        rawId: "quiet-core-bot-codex-app-server@0.2.0-beta.4",
      }),
    ).toEqual({
      pluginIds: ["quiet-core-bot-codex-app-server"],
      specOverrides: {
        "quiet-core-bot-codex-app-server": "quiet-core-bot-codex-app-server@0.2.0-beta.4",
      },
    });
  });

  it("keeps recorded npm tags when update is invoked by plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "quiet-core-bot-codex-app-server": createNpmInstall({
            spec: "quiet-core-bot-codex-app-server@beta",
            installPath: "/tmp/quiet-core-bot-codex-app-server",
            resolvedName: "quiet-core-bot-codex-app-server",
          }),
        },
        rawId: "quiet-core-bot-codex-app-server",
      }),
    ).toEqual({
      pluginIds: ["quiet-core-bot-codex-app-server"],
    });
  });

  it("maps a bare scoped npm package update to the tracked plugin id", () => {
    expect(
      resolvePluginUpdateSelection({
        installs: {
          "lossless-claw": createNpmInstall({
            spec: "@martian-engineering/lossless-claw@0.9.0",
            installPath: "/tmp/lossless-claw",
            resolvedName: "@martian-engineering/lossless-claw",
          }),
        },
        rawId: "@martian-engineering/lossless-claw",
      }),
    ).toEqual({
      pluginIds: ["lossless-claw"],
      specOverrides: {
        "lossless-claw": "@martian-engineering/lossless-claw",
      },
    });
  });
});
