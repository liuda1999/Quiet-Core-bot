# @quiet-core/tokenjuice

Official Tokenjuice output compaction plugin for OpenClaw.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
quiet-core-bot plugins install @quiet-core/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
quiet-core-bot config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
quiet-core-bot plugins enable tokenjuice
```

## Docs

- https://github.com/liuda1999/Quiet-Core-bot/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@quiet-core/tokenjuice`
- Minimum OpenClaw host: `2026.5.28`
