// Daemon restart log tests cover restart log formatting and filtering.
import { describe, expect, it } from "vitest";
import {
  GATEWAY_RESTART_LOG_FILENAME,
  renderCmdRestartLogSetup,
  renderPosixRestartLogSetup,
  resolveGatewayLogPaths,
  resolveGatewayRestartLogPath,
  resolveGatewaySupervisorLogPaths,
} from "./restart-logs.js";

describe("restart log conventions", () => {
  it("resolves profile-aware gateway logs and restart attempts together", () => {
    const env = {
      HOME: "/Users/test",
      QUIET_CORE_PROFILE: "work",
    };

    expect(resolveGatewayLogPaths(env)).toEqual({
      logDir: "/Users/test/.quiet-core-bot-work/logs",
      stdoutPath: "/Users/test/.quiet-core-bot-work/logs/gateway.log",
      stderrPath: "/Users/test/.quiet-core-bot-work/logs/gateway.err.log",
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/Users/test/.quiet-core-bot-work/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("honors QUIET_CORE_STATE_DIR for restart attempts", () => {
    const env = {
      HOME: "/Users/test",
      QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot-state",
    };

    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/tmp/quiet-core-bot-state/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("keeps macOS LaunchAgent stdout outside the state directory", () => {
    const env = {
      HOME: "/Users/test",
      QUIET_CORE_STATE_DIR: "/Volumes/External/quiet-core-bot",
    };

    expect(resolveGatewaySupervisorLogPaths(env, { platform: "darwin" })).toEqual({
      logDir: "/Users/test/Library/Logs/quiet-core-bot",
      stdoutPath: "/Users/test/Library/Logs/quiet-core-bot/gateway.log",
      stderrPath: "/Users/test/Library/Logs/quiet-core-bot/gateway.err.log",
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/Volumes/External/openclaw/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("keeps macOS LaunchAgent logs profile-aware in the shared user log directory", () => {
    const env = {
      HOME: "/Users/test",
      QUIET_CORE_PROFILE: "work",
    };

    expect(resolveGatewaySupervisorLogPaths(env, { platform: "darwin" })).toEqual({
      logDir: "/Users/test/Library/Logs/quiet-core-bot",
      stdoutPath: "/Users/test/Library/Logs/quiet-core-bot/gateway-work.log",
      stderrPath: "/Users/test/Library/Logs/quiet-core-bot/gateway-work.err.log",
    });
  });

  it("renders best-effort POSIX log setup with escaped paths", () => {
    const setup = renderPosixRestartLogSetup({
      HOME: "/Users/test's",
    });

    expect(setup).toContain(
      "if mkdir -p '/Users/test'\\''s/.quiet-core-bot/logs' 2>/dev/null && : >>'/Users/test'\\''s/.quiet-core-bot/logs/gateway-restart.log' 2>/dev/null; then",
    );
    expect(setup).toContain("exec >>'/Users/test'\\''s/.quiet-core-bot/logs/gateway-restart.log' 2>&1");
  });

  it("renders CMD log setup with quoted paths", () => {
    const setup = renderCmdRestartLogSetup({
      USERPROFILE: "C:\\Users\\Test User",
    });

    expect(setup.quotedLogPath).toBe('"C:\\Users\\Test User/.quiet-core-bot/logs/gateway-restart.log"');
    expect(setup.lines).toContain(
      'if not exist "C:\\Users\\Test User/.quiet-core-bot/logs" mkdir "C:\\Users\\Test User/.quiet-core-bot/logs" >nul 2>&1',
    );
  });
});
