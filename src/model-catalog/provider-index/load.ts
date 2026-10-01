// Provider-index loader normalizes bundled installable-provider metadata and falls back to an empty index.
import { normalizeQuietCoreProviderIndex } from "./normalize.js";
import { QUIET_CORE_PROVIDER_INDEX } from "./quiet-core-bot-provider-index.js";
import type { QuietCoreProviderIndex } from "./types.js";

// Load the bundled provider index through the normalizer. Invalid generated or
// caller-supplied data falls back to an empty v1 index instead of leaking shape.
export function loadQuietCoreProviderIndex(
  source: unknown = QUIET_CORE_PROVIDER_INDEX,
): QuietCoreProviderIndex {
  return normalizeQuietCoreProviderIndex(source) ?? { version: 1, providers: {} };
}
