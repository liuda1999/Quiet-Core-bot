/** Registry for image-generation providers contributed by plugin capabilities. */
import type { QuietCoreConfig } from "../config/types.quiet-core-bot.js";
import * as capabilityProviderRuntime from "../plugins/capability-provider-runtime.js";
import {
  buildCapabilityProviderMaps,
  normalizeCapabilityProviderId,
} from "../plugins/provider-registry-shared.js";
import type { ImageGenerationProviderPlugin } from "../plugins/types.js";

// Image-generation providers come from plugin capability registration. The
// registry keeps aliases separate from canonical ids for user config lookups.
const BUILTIN_IMAGE_GENERATION_PROVIDERS: readonly ImageGenerationProviderPlugin[] = [];
function resolvePluginImageGenerationProviders(
  cfg?: QuietCoreConfig,
): ImageGenerationProviderPlugin[] {
  return capabilityProviderRuntime.resolvePluginCapabilityProviders({
    key: "imageGenerationProviders",
    cfg,
  });
}

function buildProviderMaps(cfg?: QuietCoreConfig): {
  canonical: Map<string, ImageGenerationProviderPlugin>;
  aliases: Map<string, ImageGenerationProviderPlugin>;
} {
  return buildCapabilityProviderMaps(
    [...BUILTIN_IMAGE_GENERATION_PROVIDERS, ...resolvePluginImageGenerationProviders(cfg)],
    normalizeCapabilityProviderId,
  );
}

/** Lists canonical image-generation providers visible for config. */
export function listImageGenerationProviders(
  cfg?: QuietCoreConfig,
): ImageGenerationProviderPlugin[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

/** Resolves an image-generation provider by canonical id or alias. */
export function getImageGenerationProvider(
  providerId: string | undefined,
  cfg?: QuietCoreConfig,
): ImageGenerationProviderPlugin | undefined {
  const normalized = normalizeCapabilityProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}
