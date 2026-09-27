// Webhooks API module exposes the plugin public contract.
export {
  createFixedWindowRateLimiter,
  createWebhookInFlightLimiter,
  normalizeWebhookPath,
  readJsonWebhookBodyOrReject,
  resolveRequestClientIp,
  resolveWebhookTargetWithAuthOrReject,
  resolveWebhookTargetWithAuthOrRejectSync,
  withResolvedWebhookRequestPipeline,
  WEBHOOK_IN_FLIGHT_DEFAULTS,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  type WebhookInFlightLimiter,
} from "quiet-core-bot/plugin-sdk/webhook-ingress";
export { resolveConfiguredSecretInputString } from "quiet-core-bot/plugin-sdk/secret-input-runtime";
export type { OpenClawConfig } from "quiet-core-bot/plugin-sdk/config-contracts";
