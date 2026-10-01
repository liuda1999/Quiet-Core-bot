# @quiet-core/diagnostics-prometheus

Official Prometheus diagnostics exporter for QuietCore.

This plugin exposes QuietCore Gateway runtime metrics in Prometheus text format for Prometheus, Grafana, VictoriaMetrics, and compatible scrapers.

## Install

```bash
quiet-core-bot plugins install @quiet-core/diagnostics-prometheus
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the scrape endpoint options in `plugins.entries.diagnostics-prometheus.config`.

The full config surface, metric names, and scrape examples live in the docs:

- https://github.com/liuda1999/Quiet-Core-bot/gateway/prometheus

## Package

- Plugin id: `diagnostics-prometheus`
- Package: `@quiet-core/diagnostics-prometheus`
- Minimum QuietCore host: `2026.4.25`
