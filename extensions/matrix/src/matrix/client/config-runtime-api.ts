// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "quiet-core-bot/plugin-sdk/account-id";
export {
  isPrivateNetworkOptInEnabled,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
} from "quiet-core-bot/plugin-sdk/ssrf-runtime";
