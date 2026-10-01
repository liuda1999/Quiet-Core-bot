// Cleanup utility tests cover filesystem cleanup helpers, temp paths, and command runtime behavior.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, test, vi } from "vitest";
import type { QuietCoreConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { withEnvAsync } from "../test-utils/env.js";
import {
  buildCleanupPlan,
  removePath,
  removeStateAndLinkedPaths,
  removeWorkspaceAttestationPaths,
  removeWorkspaceDirs,
} from "./cleanup-utils.js";

describe("buildCleanupPlan", () => {
  test("resolves inside-state flags and workspace dirs", () => {
    const tmpRoot = path.join(path.parse(process.cwd()).root, "tmp");
    const defaultWorkspace = path.join(tmpRoot, "quiet-core-bot-workspace-default");
    const opsWorkspace = path.join(tmpRoot, "quiet-core-bot-workspace-ops");
    const cfg = {
      agents: {
        defaults: { workspace: defaultWorkspace },
        list: [{ id: "main" }, { id: "ops", workspace: opsWorkspace }],
      },
    };
    const plan = buildCleanupPlan({
      cfg: cfg as unknown as QuietCoreConfig,
      stateDir: path.join(tmpRoot, "quiet-core-bot-state"),
      configPath: path.join(tmpRoot, "quiet-core-bot-state", "quiet-core-bot.json"),
      oauthDir: path.join(tmpRoot, "quiet-core-bot-oauth"),
    });

    expect(plan.configInsideState).toBe(true);
    expect(plan.oauthInsideState).toBe(false);
    expect(new Set(plan.workspaceDirs)).toEqual(new Set([defaultWorkspace, opsWorkspace]));
  });

  test("includes implicit per-agent workspaces under the state dir", () => {
    const tmpRoot = path.join(path.parse(process.cwd()).root, "tmp", "quiet-core-bot-cleanup-plan");
    const home = path.join(tmpRoot, "home");
    const stateDir = path.join(home, ".quiet-core-bot");
    const cfg = {
      agents: {
        list: [{ id: "main" }, { id: "work" }],
      },
    };

    return withEnvAsync(
      {
        HOME: home,
        QUIET_CORE_STATE_DIR: stateDir,
        QUIET_CORE_WORKSPACE_DIR: undefined,
      },
      async () => {
        const plan = buildCleanupPlan({
          cfg: cfg as unknown as QuietCoreConfig,
          stateDir,
          configPath: path.join(stateDir, "quiet-core-bot.json"),
          oauthDir: path.join(stateDir, "credentials"),
        });

        expect(new Set(plan.workspaceDirs)).toEqual(
          new Set([path.join(stateDir, "workspace"), path.join(stateDir, "workspace-work")]),
        );
      },
    );
  });
});

describe("cleanup path removals", () => {
  function createRuntimeMock() {
    return {
      log: vi.fn<(message: string) => void>(),
      error: vi.fn<(message: string) => void>(),
    } as unknown as RuntimeEnv & {
      log: ReturnType<typeof vi.fn<(message: string) => void>>;
      error: ReturnType<typeof vi.fn<(message: string) => void>>;
    };
  }

  it("removes state and only linked paths outside state", async () => {
    const runtime = createRuntimeMock();
    const tmpRoot = path.join(path.parse(process.cwd()).root, "tmp", "quiet-core-bot-cleanup");
    await removeStateAndLinkedPaths(
      {
        stateDir: path.join(tmpRoot, "state"),
        configPath: path.join(tmpRoot, "state", "quiet-core-bot.json"),
        oauthDir: path.join(tmpRoot, "oauth"),
        configInsideState: true,
        oauthInsideState: false,
      },
      runtime,
      { dryRun: true },
    );

    expect(runtime.log.mock.calls.map(([line]) => line.replaceAll("\\", "/"))).toEqual([
      "[dry-run] remove /tmp/quiet-core-bot-cleanup/state",
      "[dry-run] remove /tmp/quiet-core-bot-cleanup/oauth",
    ]);
  });

  it("preserves nested workspace paths during state-only removal", async () => {
    const runtime = createRuntimeMock();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-cleanup-"));
    const stateDir = path.join(tmpRoot, ".quiet-core-bot");
    const workspaceDir = path.join(stateDir, "workspace");
    const workspaceFile = path.join(workspaceDir, "project.txt");
    const configPath = path.join(stateDir, "quiet-core-bot.json");
    const cacheFile = path.join(stateDir, "cache.json");

    try {
      await fs.mkdir(workspaceDir, { recursive: true });
      await fs.writeFile(workspaceFile, "keep me");
      await fs.writeFile(configPath, "{}");
      await fs.writeFile(cacheFile, "remove me");

      await removeStateAndLinkedPaths(
        {
          stateDir,
          configPath,
          oauthDir: path.join(stateDir, "credentials"),
          configInsideState: true,
          oauthInsideState: true,
        },
        runtime,
        { preservePaths: [workspaceDir] },
      );

      await expect(fs.readFile(workspaceFile, "utf8")).resolves.toBe("keep me");
      await expect(fs.stat(configPath)).rejects.toThrow();
      await expect(fs.stat(cacheFile)).rejects.toThrow();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("removes every workspace directory", async () => {
    const runtime = createRuntimeMock();
    const workspaces = ["/tmp/quiet-core-bot-workspace-1", "/tmp/quiet-core-bot-workspace-2"];

    await removeWorkspaceDirs(workspaces, runtime, { dryRun: true });

    const logs = runtime.log.mock.calls.map(([line]) => line);
    expect(logs).toEqual([
      "[dry-run] remove /tmp/quiet-core-bot-workspace-1",
      "[dry-run] remove /tmp/quiet-core-bot-workspace-2",
    ]);
  });

  it("removes owned legacy workspace attestations", async () => {
    const runtime = createRuntimeMock();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-cleanup-attest-"));
    const workspaceDir = path.join(tmpRoot, "workspace");
    const legacyAttestationPath = `${workspaceDir}.attested`;

    try {
      await fs.mkdir(workspaceDir, { recursive: true });
      await fs.writeFile(
        legacyAttestationPath,
        `quiet-core-bot-workspace-attestation:v1\n${new Date().toISOString()}\n`,
      );

      await removeWorkspaceAttestationPaths([workspaceDir], runtime);

      await expect(fs.stat(legacyAttestationPath)).rejects.toThrow();
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("refuses to remove the current working directory", async () => {
    const runtime = createRuntimeMock();
    const result = await removePath(process.cwd(), runtime, { dryRun: true });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBeUndefined();
    expect(runtime.error.mock.calls.length).toBe(1);
    expect(runtime.error.mock.calls[0][0]).toMatch(/Refusing to remove unsafe path/);
    expect(runtime.log.mock.calls.length).toBe(0);
  });

  it("refuses to remove a directory containing the current working directory", async () => {
    const runtime = createRuntimeMock();
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "quiet-core-bot-cleanup-cwd-"));
    const nestedCwd = path.join(tmpRoot, "nested");
    const cwdSpy = vi.spyOn(process, "cwd");

    try {
      await fs.mkdir(nestedCwd);
      cwdSpy.mockReturnValue(nestedCwd);

      const result = await removePath(tmpRoot, runtime, { dryRun: true });

      expect(result.ok).toBe(false);
      expect(result.skipped).toBeUndefined();
      expect(runtime.error.mock.calls.length).toBe(1);
      expect(runtime.error.mock.calls[0][0]).toMatch(/Refusing to remove unsafe path/);
      expect(runtime.log.mock.calls.length).toBe(0);
    } finally {
      cwdSpy.mockRestore();
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
