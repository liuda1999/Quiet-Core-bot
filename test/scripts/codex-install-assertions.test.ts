// Codex Install Assertions tests cover Codex plugin install E2E helpers.
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertPathInside,
  findPackageJson,
  npmProjectRootForInstalledPackage,
} from "../../scripts/e2e/lib/codex-install-utils.mjs";
import { cleanupTempDirs, makeTempDir } from "../helpers/temp-dir.js";

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("Codex install helpers", () => {
  it("resolves package roots and package manifests inside managed npm installs", () => {
    const root = makeTempDir(tempDirs, "openclaw-codex-install-utils-");
    const packageRoot = path.join(
      root,
      "state",
      "npm",
      "projects",
      "codex",
      "node_modules",
      "@openclaw",
      "codex",
    );
    const projectRoot = npmProjectRootForInstalledPackage(packageRoot, "@openclaw/codex");
    const dependencyPackage = path.join(
      projectRoot,
      "node_modules",
      "@openai",
      "codex",
      "package.json",
    );
    writeJson(dependencyPackage, { name: "@openai/codex" });

    expect(projectRoot).toBe(path.join(root, "state", "npm", "projects", "codex"));
    expect(findPackageJson("@openai/codex", [packageRoot, projectRoot])).toBe(dependencyPackage);
    expect(() =>
      assertPathInside(projectRoot, dependencyPackage, "codex dependency"),
    ).not.toThrow();
    expect(() => assertPathInside(projectRoot, os.tmpdir(), "outside path")).toThrow(
      "outside path resolved outside",
    );
  });
});
