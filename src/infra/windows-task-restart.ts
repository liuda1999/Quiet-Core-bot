// Relaunches the gateway through the managed Windows scheduled task.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { quoteCmdScriptArg } from "../daemon/cmd-argv.js";
import { resolveGatewayWindowsTaskName } from "../daemon/constants.js";
import { renderCmdRestartLogSetup } from "../daemon/restart-logs.js";
import { resolveTaskScriptPath } from "../daemon/schtasks.js";
import { formatErrorMessage } from "./errors.js";
import type { RestartAttempt } from "./restart.types.js";
import { resolvePreferredQuietCoreTmpDir } from "./tmp-quiet-core-bot-dir.js";
import { getWindowsCmdExePath } from "./windows-install-roots.js";

const TASK_RESTART_RETRY_LIMIT = 12;
const TASK_RESTART_RETRY_DELAY_SEC = 1;
// `ping -n <count>` waits count-1 seconds, so add one to express the delay in seconds.
const TASK_RESTART_RETRY_PING_COUNT = TASK_RESTART_RETRY_DELAY_SEC + 1;

function resolveWindowsTaskName(env: NodeJS.ProcessEnv): string {
  const override = env.QUIET_CORE_WINDOWS_TASK_NAME?.trim();
  if (override) {
    return override;
  }
  return resolveGatewayWindowsTaskName(env.QUIET_CORE_PROFILE);
}

function buildScheduledTaskRestartScript(params: {
  quotedLogPath: string;
  setupLines: string[];
  taskName: string;
  taskScriptPath?: string;
}): string {
  const { quotedLogPath, setupLines, taskName, taskScriptPath } = params;
  const quotedTaskName = quoteCmdScriptArg(taskName);
  const lines = [
    "@echo off",
    "setlocal",
    ...setupLines,
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] quiet-core-bot restart attempt source=windows-task-handoff target=${quotedTaskName}`,
    // Every failure path must leave a recognizable reason so the handoff never
    // dies silently with only the "restart attempt" line. The default covers a
    // failed task query; the retry loop overrides it when `schtasks /Run` keeps
    // failing, and the fallback branch overrides it again when no task script
    // can be launched.
    `set "restartReason=schtasks query failed target=${quotedTaskName}"`,
    `set "lastRunExit=0"`,
    // Existence probe stays inside cmd: the helper runs detached with no console
    // or standard handles, where a `powershell.exe ... | findstr` pipeline hangs
    // forever and the handoff never reaches a terminal marker.
    `schtasks /Query /TN ${quotedTaskName} >nul 2>&1`,
    "if errorlevel 1 goto fallback",
    "set /a attempts=0",
    ":retry",
    // `timeout` returns immediately when there is no console, so retries would
    // busy-loop. `ping` waits without needing a console.
    `ping -n ${TASK_RESTART_RETRY_PING_COUNT} 127.0.0.1 >nul`,
    "set /a attempts+=1",
    // `schtasks /Run` reports a non-zero code when the task already has a running
    // instance; the retry loop below absorbs that instead of racing a probe.
    `schtasks /Run /TN ${quotedTaskName} >> ${quotedLogPath} 2>&1`,
    // Capture the exit code before any other command can overwrite `errorlevel`
    // so the terminal failure marker can report the last `schtasks /Run` result.
    `set "lastRunExit=%errorlevel%"`,
    "if not errorlevel 1 goto cleanup",
    `if %attempts% GEQ ${TASK_RESTART_RETRY_LIMIT} set "restartReason=schtasks run retry limit reached target=${quotedTaskName}"`,
    `if %attempts% GEQ ${TASK_RESTART_RETRY_LIMIT} goto fallback`,
    "goto retry",
    ":fallback",
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] quiet-core-bot restart fallback source=windows-task-handoff`,
  ];
  if (taskScriptPath) {
    const quotedScript = quoteCmdScriptArg(taskScriptPath);
    const quotedCmd = quoteCmdScriptArg(getWindowsCmdExePath());
    lines.push(
      // Fall back to launching the task script directly; `if not exist ... goto`
      // keeps the branch free of parenthesized blocks so script paths with cmd
      // metacharacters cannot break command parsing.
      `if not exist ${quotedScript} goto fallback_missing`,
      `start "" /min ${quotedCmd} /d /c ${quotedScript}`,
      `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] quiet-core-bot restart fallback start source=windows-task-handoff target=${quotedScript}`,
      "goto cleanup_failed",
      ":fallback_missing",
      `set "restartReason=task script unavailable: ${quotedScript}"`,
    );
  } else {
    lines.push(`set "restartReason=task script path not configured"`);
  }
  lines.push(
    // Failure tail: reports why the handoff failed plus the last `schtasks /Run`
    // exit code, then tears down without emitting a misleading "finished" line.
    ":cleanup_failed",
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] quiet-core-bot restart failed source=windows-task-handoff reason=%restartReason% last_run_exit=%lastRunExit%`,
    "goto teardown",
    // Success tail: the script must always finish with exactly one terminal
    // marker, so this path jumps over the failure marker above.
    ":cleanup",
    `>> ${quotedLogPath} 2>&1 echo [%DATE% %TIME%] quiet-core-bot restart finished source=windows-task-handoff`,
    ":teardown",
    'del "%~f0" >nul 2>&1',
  );
  return lines.join("\r\n");
}

export function relaunchGatewayScheduledTask(env: NodeJS.ProcessEnv = process.env): RestartAttempt {
  const taskName = resolveWindowsTaskName(env);
  const taskScriptPath = resolveTaskScriptPath(env);
  const scriptPath = path.join(
    resolvePreferredQuietCoreTmpDir(),
    `quiet-core-bot-schtasks-restart-${randomUUID()}.cmd`,
  );
  const quotedScriptPath = quoteCmdScriptArg(scriptPath);
  const restartLog = renderCmdRestartLogSetup({ ...process.env, ...env });
  try {
    fs.writeFileSync(
      scriptPath,
      `${buildScheduledTaskRestartScript({
        quotedLogPath: restartLog.quotedLogPath,
        setupLines: restartLog.lines,
        taskName,
        taskScriptPath,
      })}\r\n`,
      "utf8",
    );
    const cmdExePath = getWindowsCmdExePath();
    // Launch the handoff helper through `start` so it outlives this process. A merely
    // detached cmd.exe still shares the parent console; when the gateway exits, console
    // teardown killed the helper mid-script and the gateway stayed down (the restart log
    // stopped at "restart attempt" with no finished/fallback line).
    const child = spawn(
      cmdExePath,
      ["/d", "/s", "/c", "start", "", "/min", cmdExePath, "/d", "/s", "/c", quotedScriptPath],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    child.unref();
    return {
      ok: true,
      method: "schtasks",
      tried: [`schtasks /Run /TN "${taskName}"`, `${cmdExePath} /d /s /c ${quotedScriptPath}`],
    };
  } catch (err) {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // Best-effort cleanup; keep the original restart failure.
    }
    return {
      ok: false,
      method: "schtasks",
      detail: formatErrorMessage(err),
      tried: [`schtasks /Run /TN "${taskName}"`],
    };
  }
}
