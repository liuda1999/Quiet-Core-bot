// Daemon restart log tests cover restart log formatting and filtering.
import path from "node:path";
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
      logDir: path.resolve("/Users/test/.quiet-core-bot-work/logs"),
      stdoutPath: path.resolve("/Users/test/.quiet-core-bot-work/logs/gateway.log"),
      stderrPath: path.resolve("/Users/test/.quiet-core-bot-work/logs/gateway.err.log"),
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      path.resolve(`/Users/test/.quiet-core-bot-work/logs/${GATEWAY_RESTART_LOG_FILENAME}`),
    );
  });

  it("honors QUIET_CORE_STATE_DIR for restart attempts", () => {
    const env = {
      HOME: "/Users/test",
      QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot-state",
    };

    expect(resolveGatewayRestartLogPath(env)).toBe(
      path.resolve(`/tmp/quiet-core-bot-state/logs/${GATEWAY_RESTART_LOG_FILENAME}`),
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
      path.resolve(`/Volumes/External/quiet-core-bot/logs/${GATEWAY_RESTART_LOG_FILENAME}`),
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

    // Platform-aware: the state dir resolves through path.resolve/path.join,
    // so the rendered paths follow the host separator rules.
    const restartLogPath = path.join(
      path.resolve("/Users/test's"),
      ".quiet-core-bot",
      "logs",
      GATEWAY_RESTART_LOG_FILENAME,
    );
    const restartLogDir = path.dirname(restartLogPath);
    const escape = (value: string) => value.replace(/'/g, "'\\''");

    expect(setup).toContain(
      `if mkdir -p '${escape(restartLogDir)}' 2>/dev/null && : >>'${escape(restartLogPath)}' 2>/dev/null; then`,
    );
    expect(setup).toContain(`exec >>'${escape(restartLogPath)}' 2>&1`);
  });

  it("renders CMD log setup with quoted paths", () => {
    const setup = renderCmdRestartLogSetup({
      USERPROFILE: "C:\\Users\\Test User",
    });

    const logDir = path.join(path.join("C:\\Users\\Test User", ".quiet-core-bot"), "logs");
    const restartLogPath = path.join(logDir, GATEWAY_RESTART_LOG_FILENAME);

    expect(setup.quotedLogPath).toBe(`"${restartLogPath}"`);
    expect(setup.lines).toContain(`if not exist "${logDir}" mkdir "${logDir}" >nul 2>&1`);
  });
});
