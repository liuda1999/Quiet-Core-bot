// Diagnostics Prometheus API module exposes the plugin public contract.
export type {
  DiagnosticEventMetadata,
  DiagnosticEventPayload,
} from "quiet-core-bot/plugin-sdk/diagnostic-runtime";
export { isInternalDiagnosticEventMetadata } from "quiet-core-bot/plugin-sdk/diagnostic-runtime";
export {
  emptyPluginConfigSchema,
  type OpenClawPluginApi,
  type OpenClawPluginHttpRouteHandler,
  type OpenClawPluginService,
  type OpenClawPluginServiceContext,
} from "quiet-core-bot/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "quiet-core-bot/plugin-sdk/security-runtime";
