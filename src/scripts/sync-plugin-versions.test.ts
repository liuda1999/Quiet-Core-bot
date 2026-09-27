// Plugin version sync tests cover script updates to plugin package versions.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncPluginVersions } from "../../scripts/sync-plugin-versions.js";
import { cleanupTempDirs, makeTempDir } from "../../test/helpers/temp-dir.js";

const tempDirs: string[] = [];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("syncPluginVersions", () => {
  afterEach(() => {
    cleanupTempDirs(tempDirs);
  });

  it("preserves workspace quiet-core-bot devDependencies and plugin host floors", () => {
    const rootDir = makeTempDir(tempDirs, "quiet-core-bot-sync-plugin-versions-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "quiet-core-bot",
      version: "2026.4.1",
    });
    writeJson(path.join(rootDir, "extensions/imessage/package.json"), {
      name: "@quiet-core/imessage",
      version: "2026.3.30",
      devDependencies: {
        "quiet-core-bot": "workspace:*",
      },
      peerDependencies: {
        "quiet-core-bot": ">=2026.3.30",
      },
      "quiet-core-bot": {
        install: {
          minHostVersion: ">=2026.3.30",
        },
        compat: {
          pluginApi: ">=2026.3.30",
        },
        build: {
          openclawVersion: "2026.3.30",
        },
      },
    });

    const summary = syncPluginVersions(rootDir);
    const updatedPackage = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/imessage/package.json"), "utf8"),
    ) as {
      version?: string;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      "quiet-core-bot"?: {
        install?: {
          minHostVersion?: string;
        };
        compat?: {
          pluginApi?: string;
        };
        build?: {
          openclawVersion?: string;
        };
      };
    };

    expect(summary.updated).toContain("@quiet-core/imessage");
    expect(updatedPackage.version).toBe("2026.4.1");
    expect(updatedPackage.devDependencies?.["quiet-core-bot"]).toBe("workspace:*");
    expect(updatedPackage.peerDependencies?.["quiet-core-bot"]).toBe(">=2026.4.1");
    expect(updatedPackage["quiet-core-bot"]?.install?.minHostVersion).toBe(">=2026.3.30");
    expect(updatedPackage["quiet-core-bot"]?.compat?.pluginApi).toBe(">=2026.4.1");
    expect(updatedPackage["quiet-core-bot"]?.build?.openclawVersion).toBe("2026.4.1");
  });

  it("reports pending version sync without writing in check mode", () => {
    const rootDir = makeTempDir(tempDirs, "quiet-core-bot-sync-plugin-versions-check-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "quiet-core-bot",
      version: "2026.4.2",
    });
    writeJson(path.join(rootDir, "extensions/discord/package.json"), {
      name: "@quiet-core/discord",
      version: "2026.4.1",
      peerDependencies: {
        "quiet-core-bot": ">=2026.4.1",
      },
      "quiet-core-bot": {
        compat: {
          pluginApi: ">=2026.4.1",
        },
      },
    });

    const summary = syncPluginVersions(rootDir, { write: false });
    const unchangedPackage = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/discord/package.json"), "utf8"),
    ) as {
      version?: string;
      peerDependencies?: Record<string, string>;
      "quiet-core-bot"?: {
        compat?: {
          pluginApi?: string;
        };
      };
    };

    expect(summary.updated).toEqual(["@quiet-core/discord"]);
    expect(unchangedPackage.version).toBe("2026.4.1");
    expect(unchangedPackage.peerDependencies?.["quiet-core-bot"]).toBe(">=2026.4.1");
    expect(unchangedPackage["quiet-core-bot"]?.compat?.pluginApi).toBe(">=2026.4.1");
  });

  it("uses the base release version for beta changelog entries", () => {
    const rootDir = makeTempDir(tempDirs, "quiet-core-bot-sync-plugin-versions-beta-changelog-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "quiet-core-bot",
      version: "2026.5.3-beta.1",
    });
    writeJson(path.join(rootDir, "extensions/matrix/package.json"), {
      name: "@quiet-core/matrix",
      version: "2026.5.3-beta.1",
    });
    fs.mkdirSync(path.join(rootDir, "extensions/matrix"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "extensions/matrix/CHANGELOG.md"),
      "# Changelog\n\n## 2026.5.2\n\n### Changes\n\n- Previous release.\n",
      "utf8",
    );

    const summary = syncPluginVersions(rootDir);
    const changelog = fs.readFileSync(path.join(rootDir, "extensions/matrix/CHANGELOG.md"), "utf8");

    expect(summary.changelogged).toEqual(["@quiet-core/matrix"]);
    expect(changelog).toContain("## 2026.5.3\n\n### Changes\n- Version alignment");
    expect(changelog).not.toContain("## 2026.5.3-beta.1");

    const checkSummary = syncPluginVersions(rootDir, { write: false });

    expect(checkSummary.changelogged).toStrictEqual([]);
  });
});
