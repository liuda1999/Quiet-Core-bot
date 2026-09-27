// Diagnostics Otel API module exposes the plugin public contract.
export {
  createChildDiagnosticTraceContext,
  createDiagnosticTraceContext,
  emitDiagnosticEvent,
  formatDiagnosticTraceparent,
  isValidDiagnosticSpanId,
  isValidDiagnosticTraceFlags,
  isValidDiagnosticTraceId,
  onDiagnosticEvent,
  parseDiagnosticTraceparent,
  type DiagnosticEventMetadata,
  type DiagnosticEventPayload,
  type DiagnosticTraceContext,
} from "quiet-core-bot/plugin-sdk/diagnostic-runtime";
export { emptyPluginConfigSchema, type OpenClawPluginApi } from "quiet-core-bot/plugin-sdk/plugin-entry";
export type {
  OpenClawPluginService,
  OpenClawPluginServiceContext,
} from "quiet-core-bot/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "quiet-core-bot/plugin-sdk/security-runtime";
