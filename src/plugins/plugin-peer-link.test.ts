// Covers plugin peer linking for development installs.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditQuietCorePeerDependenciesInManagedNpmRoot,
  linkQuietCorePeerDependencies,
  relinkQuietCorePeerDependenciesInManagedNpmRoot,
} from "./plugin-peer-link.js";
import { cleanupTrackedTempDirs, makeTrackedTempDir } from "./test-helpers/fs-fixtures.js";

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTrackedTempDirs(tempDirs);
});

function makeTempDir() {
  return makeTrackedTempDir("quiet-core-bot-plugin-peer-link", tempDirs);
}

describe("plugin peer links", () => {
  it("relinks quiet-core-bot peers in the managed npm root", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "peer-plugin");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({
        name: "peer-plugin",
        version: "1.0.0",
        peerDependencies: {
          "quiet-core-bot": ">=2026.0.0",
        },
      }),
      "utf8",
    );

    const messages: string[] = [];
    const result = await relinkQuietCorePeerDependenciesInManagedNpmRoot({
      npmRoot,
      logger: {
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });

    const linkPath = path.join(packageDir, "node_modules", "quiet-core-bot");
    expect(result).toEqual({ checked: 1, attempted: 1, repaired: 1, skipped: 0 });
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(linkPath)).toBe(fs.realpathSync(process.cwd()));
    expect(messages.join("\n")).toContain('Linked peerDependency "quiet-core-bot"');
  });

  it("audits missing managed npm quiet-core-bot peer links without relinking", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "peer-plugin");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({
        name: "peer-plugin",
        version: "1.0.0",
        peerDependencies: {
          "quiet-core-bot": ">=2026.0.0",
        },
      }),
      "utf8",
    );

    const result = await auditQuietCorePeerDependenciesInManagedNpmRoot({ npmRoot });

    const linkPath = path.join(packageDir, "node_modules", "quiet-core-bot");
    expect(result.checked).toBe(1);
    expect(result.broken).toBe(1);
    expect(result.issues[0]?.packageName).toBe("peer-plugin");
    expect(result.issues[0]?.reason).toContain(linkPath);
    expect(fs.existsSync(linkPath)).toBe(false);
  });

  it.runIf(process.platform !== "win32")(
    "does not follow a package-local node_modules symlink while linking quiet-core-bot peers",
    async () => {
      const root = makeTempDir();
      const packageDir = path.join(root, "peer-plugin");
      const outsideDir = path.join(root, "outside-node-modules");
      fs.mkdirSync(packageDir, { recursive: true });
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.symlinkSync(outsideDir, path.join(packageDir, "node_modules"), "dir");

      const warnings: string[] = [];
      const result = await linkQuietCorePeerDependencies({
        installedDir: packageDir,
        peerDependencies: {
          "quiet-core-bot": ">=2026.0.0",
        },
        logger: {
          warn: (message) => warnings.push(message),
        },
      });

      expect(result).toEqual({ repaired: 0, skipped: 1 });
      expect(fs.existsSync(path.join(outsideDir, "quiet-core-bot"))).toBe(false);
      expect(warnings.join("\n")).toContain("is not a real directory");
    },
  );

  it("replaces an existing real quiet-core-bot package directory", async () => {
    const root = makeTempDir();
    const packageDir = path.join(root, "peer-plugin");
    const existingQuietCoreDir = path.join(packageDir, "node_modules", "quiet-core-bot");
    fs.mkdirSync(existingQuietCoreDir, { recursive: true });
    fs.writeFileSync(path.join(existingQuietCoreDir, "package.json"), '{"name":"quiet-core-bot"}', "utf8");

    const messages: string[] = [];
    const result = await linkQuietCorePeerDependencies({
      installedDir: packageDir,
      peerDependencies: {
        "quiet-core-bot": ">=2026.0.0",
      },
      logger: {
        info: (message) => messages.push(message),
      },
    });

    expect(result).toEqual({ repaired: 1, skipped: 0 });
    expect(fs.lstatSync(existingQuietCoreDir).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(existingQuietCoreDir)).toBe(fs.realpathSync(process.cwd()));
    expect(messages.join("\n")).toContain('Linked peerDependency "quiet-core-bot"');
  });

  it("does not delete an unrelated existing package directory", async () => {
    const root = makeTempDir();
    const packageDir = path.join(root, "peer-plugin");
    const existingQuietCoreDir = path.join(packageDir, "node_modules", "quiet-core-bot");
    fs.mkdirSync(existingQuietCoreDir, { recursive: true });
    fs.writeFileSync(
      path.join(existingQuietCoreDir, "package.json"),
      '{"name":"not-quiet-core-bot"}',
      "utf8",
    );

    const warnings: string[] = [];
    const result = await linkQuietCorePeerDependencies({
      installedDir: packageDir,
      peerDependencies: {
        "quiet-core-bot": ">=2026.0.0",
      },
      logger: {
        warn: (message) => warnings.push(message),
      },
    });

    expect(result).toEqual({ repaired: 0, skipped: 1 });
    expect(fs.existsSync(path.join(existingQuietCoreDir, "package.json"))).toBe(true);
    expect(warnings.join("\n")).toContain("already exists and is not a symlink");
  });
});
