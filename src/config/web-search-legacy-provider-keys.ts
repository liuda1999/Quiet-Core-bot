/** Legacy config keys that used to live under web search provider config. */
export const LEGACY_WEB_SEARCH_PROVIDER_CONFIG_KEYS = new Set([
  "firecrawl",
  "gemini",
  "grok",
  "kimi",
  "minimax",
  "ollama",
  "searxng",
]);

export function isLegacyWebSearchProviderConfigKey(key: string): boolean {
  return LEGACY_WEB_SEARCH_PROVIDER_CONFIG_KEYS.has(key);
}
