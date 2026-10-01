// Provider-index public facade for normalized provider discovery metadata.
export { loadQuietCoreProviderIndex } from "./load.js";
export { normalizeQuietCoreProviderIndex } from "./normalize.js";
export type {
  QuietCoreProviderIndex,
  QuietCoreProviderIndexPluginInstall,
  QuietCoreProviderIndexPlugin,
  QuietCoreProviderIndexProviderAuthChoice,
  QuietCoreProviderIndexProvider,
} from "./types.js";
