// Gateway install auth policy used by service/install flows.
import { normalizeOptionalString } from "@quiet-core/normalization-core/string-coerce";
import { collectDurableServiceEnvVars } from "../config/state-dir-dotenv.js";
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import { hasConfiguredSecretInput } from "../config/types.secrets.js";

type GatewayInstallAuthMode = NonNullable<NonNullable<QuietCoreConfig["gateway"]>["auth"]>["mode"];

function hasExplicitGatewayInstallAuthMode(
  mode: GatewayInstallAuthMode | undefined,
): boolean | undefined {
  if (mode === "token") {
    return true;
  }
  if (mode === "password" || mode === "none" || mode === "trusted-proxy") {
    return false;
  }
  return undefined;
}

function hasConfiguredGatewayPasswordForInstall(cfg: QuietCoreConfig): boolean {
  return hasConfiguredSecretInput(cfg.gateway?.auth?.password, cfg.secrets?.defaults);
}

function hasDurableGatewayPasswordEnvForInstall(
  cfg: QuietCoreConfig,
  env: NodeJS.ProcessEnv,
): boolean {
  const durableServiceEnv = collectDurableServiceEnvVars({ env, config: cfg });
  return Boolean(
    normalizeOptionalString(durableServiceEnv.QUIET_CORE_GATEWAY_PASSWORD) ||
    normalizeOptionalString(durableServiceEnv.CLAWDBOT_GATEWAY_PASSWORD),
  );
}

/** Decide whether install should require token auth when no durable password source exists. */
export function shouldRequireGatewayTokenForInstall(
  cfg: QuietCoreConfig,
  env: NodeJS.ProcessEnv,
): boolean {
  const explicitModeDecision = hasExplicitGatewayInstallAuthMode(cfg.gateway?.auth?.mode);
  if (explicitModeDecision !== undefined) {
    return explicitModeDecision;
  }

  if (hasConfiguredGatewayPasswordForInstall(cfg)) {
    return false;
  }

  // Service install should only infer password mode from durable sources that
  // survive outside the invoking shell.
  if (hasDurableGatewayPasswordEnvForInstall(cfg, env)) {
    return false;
  }

  return true;
}
