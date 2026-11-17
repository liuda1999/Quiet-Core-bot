// Provider contract tests cover shared provider plugin behavior across bundled providers.
import { describeProviderContracts } from "../../plugin-sdk/test-helpers/provider-contract.js";
import { describeWebSearchProviderContracts } from "../../plugin-sdk/test-helpers/web-search-provider-contract.js";
import { filterPresentBundledExtensions } from "./test-helpers/bundled-extension-presence.js";

const TEXT_PROVIDER_PLUGIN_IDS = filterPresentBundledExtensions([
  "anthropic",
  "fal",
  "google",
  "minimax",
  "moonshot",
  "openai",
  "openrouter",
  "xai",
] as const);

const WEB_SEARCH_PROVIDER_PLUGIN_IDS = filterPresentBundledExtensions([
  "brave",
  "duckduckgo",
  "exa",
  "firecrawl",
  "google",
  "minimax",
  "moonshot",
  "parallel",
  "perplexity",
  "tavily",
  "xai",
] as const);

for (const pluginId of TEXT_PROVIDER_PLUGIN_IDS) {
  describeProviderContracts(pluginId);
}

for (const pluginId of WEB_SEARCH_PROVIDER_PLUGIN_IDS) {
  describeWebSearchProviderContracts(pluginId);
}
