// Daemon runtime hint tests cover platform-specific daemon guidance.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

const restartLogPath = path.join(
  path.resolve("/tmp/quiet-core-bot-state"),
  "logs",
  "gateway-restart.log",
);

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot-state",
          QUIET_CORE_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "quiet-core-bot-gateway",
        windowsTaskName: "Quiet Core bot Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/quiet-core-bot/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/quiet-core-bot-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot-state",
        },
        systemdServiceName: "quiet-core-bot-gateway",
        windowsTaskName: "Quiet Core bot Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u quiet-core-bot-gateway.service -n 200 --no-pager",
      `Restart attempts: ${restartLogPath}`,
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          QUIET_CORE_STATE_DIR: "/tmp/quiet-core-bot-state",
        },
        systemdServiceName: "quiet-core-bot-gateway",
        windowsTaskName: "Quiet Core bot Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "Quiet Core bot Gateway" /V /FO LIST',
      `Restart attempts: ${restartLogPath}`,
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "quiet-core-bot gateway install",
        startCommand: "quiet-core-bot gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/ai.quiet-core-bot.gateway.plist",
        systemdServiceName: "quiet-core-bot-gateway",
        windowsTaskName: "Quiet Core bot Gateway",
      }),
    ).toEqual([
      "quiet-core-bot gateway install",
      "quiet-core-bot gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.quiet-core-bot.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "quiet-core-bot gateway install",
        startCommand: "quiet-core-bot gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/ai.quiet-core-bot.gateway.plist",
        systemdServiceName: "quiet-core-bot-gateway",
        windowsTaskName: "Quiet Core bot Gateway",
      }),
    ).toEqual([
      "quiet-core-bot gateway install",
      "quiet-core-bot gateway",
      "systemctl --user start quiet-core-bot-gateway.service",
    ]);
  });
});
