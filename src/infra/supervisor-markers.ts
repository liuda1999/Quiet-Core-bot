// Defines process supervisor marker labels for gateway diagnostics.
import { GATEWAY_LAUNCH_AGENT_LABEL, resolveGatewayLaunchAgentLabel } from "../daemon/constants.js";

const SUPERVISOR_HINTS = {
  launchd: ["QUIET_CORE_LAUNCHD_LABEL"],
  systemd: ["QUIET_CORE_SYSTEMD_UNIT", "INVOCATION_ID", "SYSTEMD_EXEC_PID", "JOURNAL_STREAM"],
  schtasks: ["QUIET_CORE_WINDOWS_TASK_NAME"],
} as const;

/** Environment keys that imply the gateway process is supervised by an external respawner. */
export const SUPERVISOR_HINT_ENV_VARS = [
  "LAUNCH_JOB_LABEL",
  "LAUNCH_JOB_NAME",
  "XPC_SERVICE_NAME",
  ...SUPERVISOR_HINTS.launchd,
  ...SUPERVISOR_HINTS.systemd,
  ...SUPERVISOR_HINTS.schtasks,
  "QUIET_CORE_SERVICE_MARKER",
  "QUIET_CORE_SERVICE_KIND",
] as const;

/** Supported supervisor families that can respawn the gateway after update/restart handoff. */
export type RespawnSupervisor = "launchd" | "systemd" | "schtasks";

export interface DetectRespawnSupervisorOptions {
  includeLinuxQuietCoreGatewayServiceMarker?: boolean;
}

function hasAnyHint(env: NodeJS.ProcessEnv, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function hasQuietCoreGatewayServiceMarker(env: NodeJS.ProcessEnv): boolean {
  const marker = env.QUIET_CORE_SERVICE_MARKER?.trim();
  return (
    (marker === "quiet-core-bot" || marker === "quiet-core-bot") &&
    env.QUIET_CORE_SERVICE_KIND?.trim() === "gateway"
  );
}

function isCurrentGatewayLaunchdJob(env: NodeJS.ProcessEnv): boolean {
  const expectedLabel = resolveGatewayLaunchAgentLabel(env.QUIET_CORE_PROFILE);
  if (
    [env.LAUNCH_JOB_LABEL, env.LAUNCH_JOB_NAME].some((value) => value?.trim() === expectedLabel)
  ) {
    return true;
  }
  return env.XPC_SERVICE_NAME?.trim() === GATEWAY_LAUNCH_AGENT_LABEL;
}

/** Detects the current platform supervisor from process environment hints. */
export function detectRespawnSupervisor(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  options: DetectRespawnSupervisorOptions = {},
): RespawnSupervisor | null {
  if (platform === "darwin") {
    return hasAnyHint(env, SUPERVISOR_HINTS.launchd) || isCurrentGatewayLaunchdJob(env)
      ? "launchd"
      : null;
  }
  if (platform === "linux") {
    return hasAnyHint(env, SUPERVISOR_HINTS.systemd) ||
      (options.includeLinuxQuietCoreGatewayServiceMarker === true &&
        hasQuietCoreGatewayServiceMarker(env))
      ? "systemd"
      : null;
  }
  if (platform === "win32") {
    if (hasAnyHint(env, SUPERVISOR_HINTS.schtasks)) {
      return "schtasks";
    }
    const marker = env.QUIET_CORE_SERVICE_MARKER?.trim();
    const serviceKind = env.QUIET_CORE_SERVICE_KIND?.trim();
    return marker && serviceKind === "gateway" ? "schtasks" : null;
  }
  return null;
}
