// Diagnostics Prometheus plugin entrypoint registers its QuietCore integration.
import { definePluginEntry } from "quiet-core-bot/plugin-sdk/plugin-entry";
import { createDiagnosticsPrometheusExporter } from "./src/service.js";

const exporter = createDiagnosticsPrometheusExporter();

export default definePluginEntry({
  id: "diagnostics-prometheus",
  name: "Diagnostics Prometheus",
  description: "Expose QuietCore diagnostics metrics in Prometheus text format",
  register(api) {
    api.registerService(exporter.service);
    api.registerHttpRoute({
      path: "/api/diagnostics/prometheus",
      auth: "gateway",
      match: "exact",
      gatewayRuntimeScopeSurface: "trusted-operator",
      handler: exporter.handler,
    });
  },
});
