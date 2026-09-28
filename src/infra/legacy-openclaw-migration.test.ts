// Covers the pre-rebrand OpenClaw file/directory renames that preserve existing data.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LEGACY_AGENT_SQLITE_FILENAME,
  LEGACY_STATE_DIR_NAME,
  LEGACY_STATE_SQLITE_FILENAME,
  migrateLegacyAgentDatabaseFile,
  migrateLegacyStateDatabaseFile,
  renameLegacySqliteFile,
  renameLegacyStateDir,
} from "./legacy-openclaw-migration.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot-legacy-openclaw-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("legacy OpenClaw sqlite migration", () => {
  it("renames the legacy database and its sidecars onto the current filename", () => {
    const dir = makeTempDir();
    const legacyPath = path.join(dir, LEGACY_STATE_SQLITE_FILENAME);
    const currentPath = path.join(dir, "quiet-core-bot.sqlite");
    fs.writeFileSync(legacyPath, "legacy-db");
    fs.writeFileSync(`${legacyPath}-wal`, "legacy-wal");
    fs.writeFileSync(`${legacyPath}-shm`, "legacy-shm");

    expect(renameLegacySqliteFile({ currentPath, legacyPath })).toBe("renamed");

    expect(fs.readFileSync(currentPath, "utf8")).toBe("legacy-db");
    expect(fs.readFileSync(`${currentPath}-wal`, "utf8")).toBe("legacy-wal");
    expect(fs.readFileSync(`${currentPath}-shm`, "utf8")).toBe("legacy-shm");
    expect(fs.existsSync(legacyPath)).toBe(false);
  });

  it("keeps the current database when both names exist", () => {
    const dir = makeTempDir();
    const legacyPath = path.join(dir, LEGACY_STATE_SQLITE_FILENAME);
    const currentPath = path.join(dir, "quiet-core-bot.sqlite");
    fs.writeFileSync(legacyPath, "legacy-db");
    fs.writeFileSync(currentPath, "current-db");

    expect(renameLegacySqliteFile({ currentPath, legacyPath })).toBe("skipped-current-exists");

    expect(fs.readFileSync(currentPath, "utf8")).toBe("current-db");
    expect(fs.readFileSync(legacyPath, "utf8")).toBe("legacy-db");
  });

  it("reports a missing legacy database without touching the current path", () => {
    const dir = makeTempDir();
    const currentPath = path.join(dir, "quiet-core-bot.sqlite");

    expect(
      renameLegacySqliteFile({
        currentPath,
        legacyPath: path.join(dir, LEGACY_STATE_SQLITE_FILENAME),
      }),
    ).toBe("skipped-missing-legacy");
    expect(fs.existsSync(currentPath)).toBe(false);
  });

  it("resolves the legacy state and agent database filenames beside the current path", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, LEGACY_STATE_SQLITE_FILENAME), "state-db");
    fs.writeFileSync(path.join(dir, LEGACY_AGENT_SQLITE_FILENAME), "agent-db");

    expect(migrateLegacyStateDatabaseFile(path.join(dir, "quiet-core-bot.sqlite"))).toBe("renamed");
    expect(migrateLegacyAgentDatabaseFile(path.join(dir, "quiet-core-bot-agent.sqlite"))).toBe(
      "renamed",
    );
    expect(fs.readFileSync(path.join(dir, "quiet-core-bot.sqlite"), "utf8")).toBe("state-db");
    expect(fs.readFileSync(path.join(dir, "quiet-core-bot-agent.sqlite"), "utf8")).toBe("agent-db");
  });
});

describe("legacy OpenClaw state directory migration", () => {
  it("renames the legacy state directory when the current one is absent", () => {
    const root = makeTempDir();
    const legacyDir = path.join(root, LEGACY_STATE_DIR_NAME);
    const currentDir = path.join(root, ".quiet-core-bot");
    fs.mkdirSync(legacyDir);
    fs.writeFileSync(path.join(legacyDir, "openclaw.sqlite"), "legacy-db");

    expect(renameLegacyStateDir({ currentDir, legacyDir })).toBe("renamed");

    expect(fs.readFileSync(path.join(currentDir, "openclaw.sqlite"), "utf8")).toBe("legacy-db");
    expect(fs.existsSync(legacyDir)).toBe(false);
  });

  it("keeps both directories when the current state directory already exists", () => {
    const root = makeTempDir();
    const legacyDir = path.join(root, LEGACY_STATE_DIR_NAME);
    const currentDir = path.join(root, ".quiet-core-bot");
    fs.mkdirSync(legacyDir);
    fs.mkdirSync(currentDir);

    expect(renameLegacyStateDir({ currentDir, legacyDir })).toBe("skipped-current-exists");

    expect(fs.existsSync(legacyDir)).toBe(true);
    expect(fs.existsSync(currentDir)).toBe(true);
  });

  it("does nothing when the legacy state directory is absent", () => {
    const root = makeTempDir();
    expect(
      renameLegacyStateDir({
        currentDir: path.join(root, ".quiet-core-bot"),
        legacyDir: path.join(root, LEGACY_STATE_DIR_NAME),
      }),
    ).toBe("skipped-missing-legacy");
  });
});
