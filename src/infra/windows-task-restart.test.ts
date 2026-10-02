// Covers Windows scheduled-task gateway restart script generation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { captureFullEnv } from "../test-utils/env.js";
import { getWindowsCmdExePath } from "./windows-install-roots.js";

const spawnMock = vi.hoisted(() => vi.fn());
const resolvePreferredQuietCoreTmpDirMock = vi.hoisted(() => vi.fn(() => os.tmpdir()));
const resolveTaskScriptPathMock = vi.hoisted(() =>
  vi.fn((env: Record<string, string | undefined>) => {
    const home = env.USERPROFILE || env.HOME || os.homedir();
    return path.join(home, ".quiet-core-bot", "gateway.cmd");
  }),
);

vi.mock("node:child_process", async () => {
  const { mockNodeBuiltinModule } = await import("quiet-core-bot/plugin-sdk/test-node-mocks");
  return mockNodeBuiltinModule(
    () => vi.importActual<typeof import("node:child_process")>("node:child_process"),
    {
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
  );
});
vi.mock("./tmp-quiet-core-bot-dir.js", () => ({
  resolvePreferredQuietCoreTmpDir: () => resolvePreferredQuietCoreTmpDirMock(),
}));
vi.mock("../daemon/schtasks.js", () => ({
  resolveTaskScriptPath: (env: Record<string, string | undefined>) =>
    resolveTaskScriptPathMock(env),
}));

type WindowsTaskRestartModule = typeof import("./windows-task-restart.js");

let relaunchGatewayScheduledTask: WindowsTaskRestartModule["relaunchGatewayScheduledTask"];

const envSnapshot = captureFullEnv();
const createdScriptPaths = new Set<string>();
const createdTmpDirs = new Set<string>();

function decodeCmdPathArg(value: string): string {
  const trimmed = value.trim();
  const withoutQuotes =
    trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  return withoutQuotes.replace(/\^!/g, "!").replace(/%%/g, "%");
}

function requireFirstMockCall<T>(mock: { mock: { calls: T[][] } }, label: string): T[] {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error(`expected ${label} call`);
  }
  return call;
}

afterEach(() => {
  envSnapshot.restore();
  for (const scriptPath of createdScriptPaths) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Best-effort cleanup for temp helper scripts created in tests.
    }
  }
  createdScriptPaths.clear();
  for (const tmpDir of createdTmpDirs) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup for test temp roots.
    }
  }
  createdTmpDirs.clear();
});

describe("relaunchGatewayScheduledTask", () => {
  beforeAll(async () => {
    ({ relaunchGatewayScheduledTask } = await import("./windows-task-restart.js"));
  });

  beforeEach(() => {
    spawnMock.mockReset();
    resolvePreferredQuietCoreTmpDirMock.mockReset();
    resolvePreferredQuietCoreTmpDirMock.mockReturnValue(os.tmpdir());
    resolveTaskScriptPathMock.mockReset();
    resolveTaskScriptPathMock.mockImplementation((env: Record<string, string | undefined>) => {
      const home = env.USERPROFILE || env.HOME || os.homedir();
      return path.join(home, ".quiet-core-bot", "gateway.cmd");
    });
  });

  it("writes a detached schtasks relaunch helper", () => {
    const unref = vi.fn();
    let seenCommandArg = "";
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      seenCommandArg = args[args.length - 1];
      createdScriptPaths.add(decodeCmdPathArg(seenCommandArg));
      return { unref };
    });

    const result = relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });
    const cmdExePath = getWindowsCmdExePath();

    expect(result.ok).toBe(true);
    expect(result.method).toBe("schtasks");
    expect(result.tried).toContain('schtasks /Run /TN "Quiet Core Gateway (work)"');
    expect(result.tried).toContain(`${cmdExePath} /d /s /c ${seenCommandArg}`);
    const spawnCall = requireFirstMockCall(spawnMock, "restart helper spawn");
    expect(spawnCall[0]).toBe(cmdExePath);
    // The helper must be launched through `start` so a detached cmd.exe does not
    // share the gateway console and get torn down when the gateway exits.
    expect(spawnCall[1]).toStrictEqual([
      "/d",
      "/s",
      "/c",
      "start",
      "",
      "/min",
      cmdExePath,
      "/d",
      "/s",
      "/c",
      seenCommandArg,
    ]);
    expect(spawnCall[1]).toContain("start");
    expect(spawnCall[2]).toStrictEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    expect(unref).toHaveBeenCalledOnce();

    const scriptPath = [...createdScriptPaths][0];
    if (scriptPath === undefined) {
      throw new Error("expected restart helper script path");
    }
    expect(fs.statSync(scriptPath).isFile()).toBe(true);
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain("gateway-restart.log");
    expect(script).toContain(
      'quiet-core-bot restart attempt source=windows-task-handoff target="Quiet Core Gateway (work)"',
    );
    // The helper runs detached without standard handles, so every probe must be
    // cmd-native: PowerShell pipelines hang and `timeout` returns instantly there.
    expect(script).not.toContain("powershell");
    expect(script).not.toContain("timeout /t");
    expect(script).toContain('schtasks /Query /TN "Quiet Core Gateway (work)" >nul 2>&1');
    expect(script).toContain("if errorlevel 1 goto fallback");
    expect(script).toContain("ping -n 2 127.0.0.1 >nul");
    expect(script).toContain('schtasks /Run /TN "Quiet Core Gateway (work)" >>');
    expect(script.indexOf('schtasks /Query /TN "Quiet Core Gateway (work)"')).toBeLessThan(
      script.indexOf('schtasks /Run /TN "Quiet Core Gateway (work)"'),
    );
    expect(script).toContain('del "%~f0" >nul 2>&1');
  });

  it("prefers QUIET_CORE_WINDOWS_TASK_NAME overrides", () => {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({
      QUIET_CORE_PROFILE: "work",
      QUIET_CORE_WINDOWS_TASK_NAME: "Quiet Core bot Gateway (custom)",
    });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain('schtasks /Run /TN "Quiet Core bot Gateway (custom)" >>');
  });

  it("escapes custom task names in the schtasks probes", () => {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({
      QUIET_CORE_WINDOWS_TASK_NAME: "Quiet Core bot Gateway (Bob's work)",
    });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain(`schtasks /Query /TN "Quiet Core bot Gateway (Bob's work)" >nul 2>&1`);
    expect(script).toContain(`schtasks /Run /TN "Quiet Core bot Gateway (Bob's work)" >>`);
  });

  it("returns failed when the helper cannot be spawned", () => {
    spawnMock.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    const result = relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    expect(result.ok).toBe(false);
    expect(result.method).toBe("schtasks");
    expect(result.detail).toContain("spawn failed");
  });

  it("quotes the cmd /c script path when temp paths contain metacharacters", () => {
    const unref = vi.fn();
    const metacharTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot&(restart)-"));
    createdTmpDirs.add(metacharTmpDir);
    resolvePreferredQuietCoreTmpDirMock.mockReturnValue(metacharTmpDir);
    spawnMock.mockReturnValue({ unref });

    relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    expect(spawnMock).toHaveBeenCalledOnce();
    const spawnCall = requireFirstMockCall(spawnMock, "restart helper spawn");
    const commandArgs = spawnCall[1];
    if (!Array.isArray(commandArgs)) {
      throw new Error("expected cmd.exe argument array");
    }
    const commandArg = commandArgs[commandArgs.length - 1];
    if (typeof commandArg !== "string") {
      throw new Error("expected quoted restart helper path");
    }
    expect(spawnCall[0]).toBe(getWindowsCmdExePath());
    expect(commandArgs).toStrictEqual([
      "/d",
      "/s",
      "/c",
      "start",
      "",
      "/min",
      getWindowsCmdExePath(),
      "/d",
      "/s",
      "/c",
      commandArg,
    ]);
    expect(commandArg.startsWith('"')).toBe(true);
    expect(commandArg.endsWith('"')).toBe(true);
    expect(commandArg).toContain("&");
    expect(spawnCall[2]).toStrictEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  it("includes startup fallback", () => {
    const taskScriptDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-core-bot-state-"));
    createdTmpDirs.add(taskScriptDir);
    const taskScriptPath = path.join(taskScriptDir, "gateway.cmd");
    fs.writeFileSync(taskScriptPath, "@echo off\r\nrem placeholder\r\n", "utf8");
    resolveTaskScriptPathMock.mockReturnValue(taskScriptPath);

    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    const result = relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    expect(result.ok).toBe(true);
    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain(`schtasks /Query /TN`);
    expect(script).toContain(":fallback");
    expect(script).toContain("goto fallback_missing");
    expect(script).toContain(`start "" /min ${getWindowsCmdExePath()} /d /c`);
    expect(script).toContain(taskScriptPath);
    // The fallback launches the task script and then reports the failure tail.
    expect(script.indexOf('start "" /min')).toBeLessThan(script.indexOf(":cleanup_failed"));
    expect(script).toContain("goto cleanup_failed");
  });

  it("records a failure marker with reason and last schtasks exit code when retries are exhausted", () => {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    // The retry limit sets a reason and captures the last `schtasks /Run` code.
    expect(script).toContain(
      'if %attempts% GEQ 12 set "restartReason=schtasks run retry limit reached target="Quiet Core Gateway (work)""',
    );
    expect(script).toContain('set "lastRunExit=%errorlevel%"');
    expect(script).toContain(
      "quiet-core-bot restart failed source=windows-task-handoff reason=%restartReason% last_run_exit=%lastRunExit%",
    );
  });

  it("states a failure reason when no task script is available", () => {
    resolveTaskScriptPathMock.mockReturnValue("");

    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain('set "restartReason=task script path not configured"');
    expect(script).not.toContain("goto fallback_missing");
    expect(script).toContain("quiet-core-bot restart failed source=windows-task-handoff");
  });

  it("always closes with exactly one terminal restart marker", () => {
    spawnMock.mockImplementation((_file: string, args: string[]) => {
      createdScriptPaths.add(decodeCmdPathArg(args[args.length - 1]));
      return { unref: vi.fn() };
    });

    relaunchGatewayScheduledTask({ QUIET_CORE_PROFILE: "work" });

    const scriptPath = [...createdScriptPaths][0];
    const script = fs.readFileSync(scriptPath, "utf8");
    expect(script).toContain("quiet-core-bot restart finished source=windows-task-handoff");
    expect(script).toContain(
      "quiet-core-bot restart failed source=windows-task-handoff reason=%restartReason% last_run_exit=%lastRunExit%",
    );
    // Failure tail jumps over the success tail so a run emits exactly one of them.
    const failedIndex = script.indexOf("quiet-core-bot restart failed source=windows-task-handoff");
    const finishedIndex = script.indexOf(
      "quiet-core-bot restart finished source=windows-task-handoff",
    );
    expect(failedIndex).toBeGreaterThan(-1);
    expect(finishedIndex).toBeGreaterThan(failedIndex);
    expect(script.slice(failedIndex, finishedIndex)).toContain("goto teardown");
    expect(script.includes("restart finished") || script.includes("restart failed")).toBe(true);
    expect(script).toContain('del "%~f0" >nul 2>&1');
  });
});
