/** Migration provider lookup, option shaping, and plan creation helpers. */
import { getRuntimeConfig } from "../../config/config.js";
import {
  ensureStandaloneMigrationProviderRegistryLoaded,
  resolvePluginMigrationProvider,
  resolvePluginMigrationProviders,
} from "../../plugins/migration-provider-runtime.js";
import type { MigrationPlan, MigrationProviderPlugin } from "../../plugins/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import { buildMigrationContext } from "./context.js";
import type { MigrateCommonOptions } from "./types.js";

/** Resolves a migration provider from the loaded plugin migration registry. */
export function resolveMigrationProvider(
  providerId: string,
  config = getRuntimeConfig(),
): MigrationProviderPlugin {
  ensureStandaloneMigrationProviderRegistryLoaded({ cfg: config });
  const provider = resolvePluginMigrationProvider({ providerId, cfg: config });
  if (!provider) {
    const available = resolvePluginMigrationProviders({ cfg: config }).map((entry) => entry.id);
    const suffix =
      available.length > 0
        ? ` Available providers: ${available.join(", ")}.`
        : " No providers found.";
    throw new Error(`Unknown migration provider "${providerId}".${suffix}`);
  }
  return provider;
}

/** Creates a migration plan after validating provider-specific flag support. */
export async function createMigrationPlan(
  runtime: RuntimeEnv,
  opts: MigrateCommonOptions & { provider: string },
): Promise<MigrationPlan> {
  const provider = resolveMigrationProvider(opts.provider, opts.configOverride);
  const ctx = buildMigrationContext({
    source: opts.source,
    includeSecrets: opts.includeSecrets,
    overwrite: opts.overwrite,
    configOverride: opts.configOverride,
    runtime,
    json: opts.json,
  });
  return await provider.plan(ctx);
}
