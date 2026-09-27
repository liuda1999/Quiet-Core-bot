// Covers supervisor marker files used to identify managed Quiet Core bot processes.
import { describe, expect, it } from "vitest";
import { detectRespawnSupervisor, SUPERVISOR_HINT_ENV_VARS } from "./supervisor-markers.js";

describe("SUPERVISOR_HINT_ENV_VARS", () => {
  it("includes the cross-platform supervisor hint env vars", () => {
    const envVars = new Set(SUPERVISOR_HINT_ENV_VARS);
    expect(envVars.has("LAUNCH_JOB_LABEL")).toBe(true);
    expect(envVars.has("INVOCATION_ID")).toBe(true);
    expect(envVars.has("QUIET_CORE_WINDOWS_TASK_NAME")).toBe(true);
    expect(envVars.has("QUIET_CORE_SERVICE_MARKER")).toBe(true);
    expect(envVars.has("QUIET_CORE_SERVICE_KIND")).toBe(true);
  });
});

describe("detectRespawnSupervisor", () => {
  it("detects launchd from Quiet Core bot's explicit marker or current gateway launchd job", () => {
    expect(
      detectRespawnSupervisor({ QUIET_CORE_LAUNCHD_LABEL: " ai.quiet-core-bot.gateway " }, "darwin"),
    ).toBe("launchd");
    expect(detectRespawnSupervisor({ QUIET_CORE_LAUNCHD_LABEL: "   " }, "darwin")).toBeNull();
    expect(detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.quiet-core-bot.gateway" }, "darwin")).toBe(
      "launchd",
    );
    expect(
      detectRespawnSupervisor(
        { LAUNCH_JOB_NAME: "ai.quiet-core-bot.work", QUIET_CORE_PROFILE: "work" },
        "darwin",
      ),
    ).toBe("launchd");
    expect(detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.quiet-core-bot.mac" }, "darwin")).toBeNull();
    expect(detectRespawnSupervisor({ XPC_SERVICE_NAME: "ai.quiet-core-bot.mac" }, "darwin")).toBeNull();
    expect(
      detectRespawnSupervisor(
        { XPC_SERVICE_NAME: "ai.quiet-core-bot.mac", QUIET_CORE_PROFILE: "mac" },
        "darwin",
      ),
    ).toBeNull();
    expect(detectRespawnSupervisor({ XPC_SERVICE_NAME: "ai.quiet-core-bot.gateway" }, "darwin")).toBe(
      "launchd",
    );
  });

  it("detects systemd only from non-blank platform-specific hints", () => {
    expect(detectRespawnSupervisor({ INVOCATION_ID: "abc123" }, "linux")).toBe("systemd");
    expect(detectRespawnSupervisor({ JOURNAL_STREAM: "" }, "linux")).toBeNull();
  });

  it("detects Linux Quiet Core bot gateway service markers only for opt-in callers", () => {
    const gatewayServiceEnv = {
      QUIET_CORE_SERVICE_MARKER: " quiet-core-bot ",
      QUIET_CORE_SERVICE_KIND: " gateway ",
    };
    expect(detectRespawnSupervisor(gatewayServiceEnv, "linux")).toBeNull();
    expect(
      detectRespawnSupervisor(gatewayServiceEnv, "linux", {
        includeLinuxOpenClawGatewayServiceMarker: true,
      }),
    ).toBe("systemd");
    expect(
      detectRespawnSupervisor(
        {
          QUIET_CORE_SERVICE_MARKER: "quiet-core-bot",
          QUIET_CORE_SERVICE_KIND: "worker",
        },
        "linux",
        { includeLinuxOpenClawGatewayServiceMarker: true },
      ),
    ).toBeNull();
    expect(
      detectRespawnSupervisor(
        {
          QUIET_CORE_SERVICE_MARKER: "other",
          QUIET_CORE_SERVICE_KIND: "gateway",
        },
        "linux",
        { includeLinuxOpenClawGatewayServiceMarker: true },
      ),
    ).toBeNull();
  });

  it("detects scheduled-task supervision on Windows from either hint family", () => {
    expect(
      detectRespawnSupervisor({ QUIET_CORE_WINDOWS_TASK_NAME: "Quiet Core bot Gateway" }, "win32"),
    ).toBe("schtasks");
    expect(
      detectRespawnSupervisor(
        {
          QUIET_CORE_SERVICE_MARKER: "quiet-core-bot",
          QUIET_CORE_SERVICE_KIND: "gateway",
        },
        "win32",
      ),
    ).toBe("schtasks");
    expect(
      detectRespawnSupervisor(
        {
          QUIET_CORE_SERVICE_MARKER: "quiet-core-bot",
          QUIET_CORE_SERVICE_KIND: "worker",
        },
        "win32",
      ),
    ).toBeNull();
  });

  it("ignores service markers on non-Windows platforms and unknown platforms", () => {
    expect(
      detectRespawnSupervisor(
        {
          QUIET_CORE_SERVICE_MARKER: "quiet-core-bot",
          QUIET_CORE_SERVICE_KIND: "gateway",
        },
        "linux",
      ),
    ).toBeNull();
    expect(
      detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.quiet-core-bot.gateway" }, "freebsd"),
    ).toBeNull();
  });
});
