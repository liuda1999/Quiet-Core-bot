// Covers the one-off state directory relocation planner, applier, and verifier.
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withTempDir } from "../test-helpers/temp-dir.js";
import {
  applyStateDirMigration,
  planStateDirMigration,
  verifyStateDirMigration,
} from "./state-dir-migration.js";

async function seedSource(root: string): Promise<string> {
  const from = path.join(root, "legacy");
  await fs.mkdir(path.join(from, "agents", "main", "sessions"), { recursive: true });
  await fs.writeFile(path.join(from, "agents", "main", "sessions", "s1.jsonl"), "{}\n", "utf-8");
  await fs.mkdir(path.join(from, "workspace"), { recursive: true });
  await fs.writeFile(path.join(from, "workspace", "NOTES.md"), "notes\n", "utf-8");
  await fs.mkdir(path.join(from, "logs"), { recursive: true });
  await fs.writeFile(path.join(from, "logs", "gateway.log"), "log\n", "utf-8");
  await fs.mkdir(path.join(from, "tmp"), { recursive: true });
  await fs.writeFile(path.join(from, "tmp", "scratch.txt"), "scratch\n", "utf-8");
  await fs.writeFile(path.join(from, "openclaw.json"), '{"a":1}\n', "utf-8");
  await fs.writeFile(path.join(from, "session.lock"), "lock\n", "utf-8");
  return from;
}

describe("planStateDirMigration", () => {
  it("excludes transient entries and renames the config file", async () => {
    await withTempDir({ prefix: "qcore-mig-plan-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");

      const plan = await planStateDirMigration({ from, to });

      const names = plan.entries.map((entry) => entry.name);
      expect(names).toContain("agents");
      expect(names).toContain("workspace");
      // Transient entries stay visible in the plan but are marked as skipped.
      const skippedNames = plan.entries
        .filter((entry) => entry.action === "skip")
        .map((entry) => entry.name);
      expect(skippedNames).toEqual(["logs", "session.lock", "tmp"]);
      // The config is carried over separately, not as a plain entry.
      expect(names).not.toContain("openclaw.json");
      expect(plan.configRename).toEqual({
        sourcePath: path.join(from, "openclaw.json"),
        targetPath: path.join(to, "quiet-core-bot.json"),
      });
      expect(plan.stats.skipped).toBe(3);
      expect(plan.stats.toCopy).toBe(2);
      expect(plan.stats.conflicts).toBe(0);
    });
  });

  it("prefers the current config file name over the legacy one", async () => {
    await withTempDir({ prefix: "qcore-mig-plan-current-" }, async (root) => {
      const from = await seedSource(root);
      await fs.writeFile(path.join(from, "quiet-core-bot.json"), '{"b":2}\n', "utf-8");

      const plan = await planStateDirMigration({ from, to: path.join(root, "current") });

      expect(plan.configRename?.sourcePath).toBe(path.join(from, "quiet-core-bot.json"));
    });
  });

  it("rejects a source that is not a directory", async () => {
    await withTempDir({ prefix: "qcore-mig-plan-bad-" }, async (root) => {
      const notADir = path.join(root, "file.txt");
      await fs.writeFile(notADir, "x", "utf-8");
      await expect(
        planStateDirMigration({ from: notADir, to: path.join(root, "current") }),
      ).rejects.toThrow(/not a directory/u);
    });
  });

  it("reports a null configRename when the source has no config file", async () => {
    await withTempDir({ prefix: "qcore-mig-plan-noconfig-" }, async (root) => {
      const from = path.join(root, "legacy");
      await fs.mkdir(path.join(from, "agents"), { recursive: true });

      const plan = await planStateDirMigration({ from, to: path.join(root, "current") });

      expect(plan.configRename).toBeNull();
    });
  });
});

describe("applyStateDirMigration", () => {
  it("copies substantive data, writes the renamed config, and leaves the source intact", async () => {
    await withTempDir({ prefix: "qcore-mig-apply-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      const plan = await planStateDirMigration({ from, to });

      const applied = await applyStateDirMigration({ plan });

      expect(await fs.readFile(path.join(to, "quiet-core-bot.json"), "utf-8")).toBe('{"a":1}\n');
      expect(
        await fs.readFile(path.join(to, "agents", "main", "sessions", "s1.jsonl"), "utf-8"),
      ).toBe("{}\n");
      expect(await fs.readFile(path.join(to, "workspace", "NOTES.md"), "utf-8")).toBe("notes\n");
      expect(applied.configPath).toBe(path.join(to, "quiet-core-bot.json"));
      // Source untouched, transient entries not copied.
      expect(await fs.readFile(path.join(from, "openclaw.json"), "utf-8")).toBe('{"a":1}\n');
      await expect(fs.stat(path.join(to, "logs"))).rejects.toThrow();
      await expect(fs.stat(path.join(to, "tmp"))).rejects.toThrow();
    });
  });

  it("is idempotent: a second apply reports existing entries and keeps content stable", async () => {
    await withTempDir({ prefix: "qcore-mig-idem-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      const plan = await planStateDirMigration({ from, to });

      await applyStateDirMigration({ plan });
      const second = await applyStateDirMigration({ plan });

      expect(second.skippedExisting.length).toBeGreaterThan(0);
      expect(second.conflictBackups).toHaveLength(0);
      expect(await fs.readFile(path.join(to, "quiet-core-bot.json"), "utf-8")).toBe('{"a":1}\n');
      const verification = await verifyStateDirMigration({ from, to });
      expect(verification.ok).toBe(true);
    });
  });

  it("backs up an existing target entry before overwriting it", async () => {
    await withTempDir({ prefix: "qcore-mig-overwrite-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      // Leftover of an aborted migration: a stale config and a stale workspace dir.
      await fs.mkdir(path.join(to, "workspace"), { recursive: true });
      await fs.writeFile(path.join(to, "workspace", "STALE.md"), "stale\n", "utf-8");
      await fs.writeFile(path.join(to, "quiet-core-bot.json"), '{"stale":true}\n', "utf-8");
      const plan = await planStateDirMigration({ from, to });

      const applied = await applyStateDirMigration({ plan, overwrite: true });

      expect(applied.conflictBackups.length).toBeGreaterThan(0);
      expect(await fs.readFile(path.join(to, "quiet-core-bot.json"), "utf-8")).toBe('{"a":1}\n');
      expect(await fs.readFile(path.join(to, "quiet-core-bot.json.pre-migration"), "utf-8")).toBe(
        '{"stale":true}\n',
      );
      expect(await fs.readFile(path.join(to, "workspace", "NOTES.md"), "utf-8")).toBe("notes\n");
      await expect(fs.stat(path.join(to, "workspace", "STALE.md"))).rejects.toThrow();
    });
  });

  it("keeps existing target content when overwrite is disabled", async () => {
    await withTempDir({ prefix: "qcore-mig-nooverwrite-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      await fs.mkdir(to, { recursive: true });
      await fs.writeFile(path.join(to, "quiet-core-bot.json"), '{"keep":true}\n', "utf-8");
      const plan = await planStateDirMigration({ from, to });

      await applyStateDirMigration({ plan, overwrite: false });

      expect(await fs.readFile(path.join(to, "quiet-core-bot.json"), "utf-8")).toBe(
        '{"keep":true}\n',
      );
    });
  });
});

describe("verifyStateDirMigration", () => {
  it("flags a substantive subtree whose entry count differs", async () => {
    await withTempDir({ prefix: "qcore-mig-verify-bad-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      const plan = await planStateDirMigration({ from, to });
      await applyStateDirMigration({ plan });
      // Simulate a partially failed copy.
      await fs.rm(path.join(to, "workspace"), { recursive: true, force: true });

      const verification = await verifyStateDirMigration({ from, to });

      expect(verification.ok).toBe(false);
      expect(verification.mismatch).toContain("workspace");
      expect(verification.counts.workspace).toEqual({ source: 1, target: 0 });
    });
  });

  it("flags a missing config file", async () => {
    await withTempDir({ prefix: "qcore-mig-verify-noconfig-" }, async (root) => {
      const from = path.join(root, "legacy");
      await fs.mkdir(path.join(from, "agents"), { recursive: true });
      const to = path.join(root, "current");
      await fs.mkdir(path.join(to, "agents"), { recursive: true });

      const verification = await verifyStateDirMigration({ from, to });

      expect(verification.ok).toBe(false);
      expect(verification.mismatch).toContain("quiet-core-bot.json");
    });
  });

  it("passes when the substantive subtrees match", async () => {
    await withTempDir({ prefix: "qcore-mig-verify-ok-" }, async (root) => {
      const from = await seedSource(root);
      const to = path.join(root, "current");
      await applyStateDirMigration({ plan: await planStateDirMigration({ from, to }) });

      const verification = await verifyStateDirMigration({ from, to });

      expect(verification.ok).toBe(true);
      expect(verification.mismatch).toEqual([]);
    });
  });
});
