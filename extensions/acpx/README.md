# @quiet-core/acpx

Official ACP runtime backend for OpenClaw.

ACPx lets OpenClaw run external coding harnesses through the Agent Client Protocol while OpenClaw still owns sessions, channels, delivery, permissions, and Gateway state.

## Install

```bash
quiet-core-bot plugins install @quiet-core/acpx
```

Restart the Gateway after installing or updating the plugin.

## What it provides

- ACP-backed agent runtime sessions.
- Plugin-owned session and transport management.
- MCP bridge helpers for OpenClaw tools and plugin tools.
- Static runtime assets used by the ACP process bridge.

## Configure

Use the ACP docs for harness-specific setup, permission modes, and model/runtime selection:

- https://github.com/liuda1999/Quiet-Core-bot/tools/acp-agents-setup
- https://github.com/liuda1999/Quiet-Core-bot/tools/acp-agents

## Package

- Plugin id: `acpx`
- Package: `@quiet-core/acpx`
- Minimum OpenClaw host: `2026.4.25`
