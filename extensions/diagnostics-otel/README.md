# @quiet-core/diagnostics-otel

Official OpenTelemetry diagnostics exporter for QuietCore.

This plugin exports QuietCore Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors. It can also write diagnostic log records as stdout JSONL for container log pipelines.

## Install

```bash
quiet-core-bot plugins install @quiet-core/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the OTLP endpoint in `plugins.entries.diagnostics-otel.config`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://github.com/liuda1999/Quiet-Core-bot/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@quiet-core/diagnostics-otel`
- Minimum QuietCore host: `2026.4.25`
