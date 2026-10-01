// Registers music generation provider runtimes by normalized provider id.
import type { QuietCoreConfig } from "../config/types.js";
import { resolvePluginCapabilityProviders } from "../plugins/capability-provider-runtime.js";
import {
  buildCapabilityProviderMaps,
  normalizeCapabilityProviderId,
} from "../plugins/provider-registry-shared.js";
import type { MusicGenerationProviderPlugin } from "../plugins/types.js";

/**
 * Registry for music generation providers.
 *
 * Built-ins and plugin-provided capability providers share one alias map while
 * rejecting unsafe object keys before they reach Maps or config-derived lookups.
 */
const BUILTIN_MUSIC_GENERATION_PROVIDERS: readonly MusicGenerationProviderPlugin[] = [];

function resolvePluginMusicGenerationProviders(
  cfg?: QuietCoreConfig,
): MusicGenerationProviderPlugin[] {
  return resolvePluginCapabilityProviders({
    key: "musicGenerationProviders",
    cfg,
  });
}

function buildProviderMaps(cfg?: QuietCoreConfig): {
  canonical: Map<string, MusicGenerationProviderPlugin>;
  aliases: Map<string, MusicGenerationProviderPlugin>;
} {
  return buildCapabilityProviderMaps(
    [...BUILTIN_MUSIC_GENERATION_PROVIDERS, ...resolvePluginMusicGenerationProviders(cfg)],
    normalizeCapabilityProviderId,
  );
}

/** List canonical music generation providers available for the current config. */
export function listMusicGenerationProviders(
  cfg?: QuietCoreConfig,
): MusicGenerationProviderPlugin[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

/** Resolve a music generation provider by canonical id or alias. */
export function getMusicGenerationProvider(
  providerId: string | undefined,
  cfg?: QuietCoreConfig,
): MusicGenerationProviderPlugin | undefined {
  const normalized = normalizeCapabilityProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}
