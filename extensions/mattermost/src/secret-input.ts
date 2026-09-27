// Mattermost plugin module implements secret input behavior.
export type { SecretInput } from "quiet-core-bot/plugin-sdk/secret-input";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "quiet-core-bot/plugin-sdk/secret-input";
