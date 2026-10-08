---
summary: "Gateway runtime on macOS (external launchd service)"
read_when:
  - Packaging Quiet Core bot.app
  - Debugging the macOS gateway launchd service
  - Installing the gateway CLI for macOS
title: "Gateway on macOS"
---

Quiet Core bot.app no longer bundles Node/Bun or the Gateway runtime. The macOS app
expects an **external** `quiet-core-bot` CLI install, does not spawn the Gateway as a
child process, and manages a per-user launchd service to keep the Gateway
running (or attaches to an existing local Gateway if one is already running).

## Install the CLI (required for local mode)

Node 24 is the default runtime on the Mac. Node 22 LTS, currently `22.19+`, still works for compatibility. Then install `quiet-core-bot` globally:

```bash
npm install -g quiet-core-bot@<version>
```

> ⚠️ The npm package `quiet-core-bot` is **not published yet**, so this command fails. Build from source or run the installer with `--install-method git`.

The macOS app's **Install CLI** button runs the same global install flow the app
uses internally: it prefers npm first, then pnpm, then bun if that is the only
detected package manager. Node remains the recommended Gateway runtime.

## Launchd (Gateway as LaunchAgent)

Label:

- `ai.quiet-core-bot.gateway` (or `ai.quiet-core-bot.<profile>`; legacy `com.openclaw.*` may remain)

Plist location (per-user):

- `~/Library/LaunchAgents/ai.quiet-core-bot.gateway.plist`
  (or `~/Library/LaunchAgents/ai.quiet-core-bot.<profile>.plist`)

Manager:

- The macOS app owns LaunchAgent install/update in Local mode.
- The CLI can also install it: `quiet-core-bot gateway install`.

Behavior:

- "Quiet Core bot Active" enables/disables the LaunchAgent.
- App quit does **not** stop the gateway (launchd keeps it alive).
- If a Gateway is already running on the configured port, the app attaches to
  it instead of starting a new one.

Logging:

- launchd stdout: `~/Library/Logs/quiet-core-bot/gateway.log` (profiles use `gateway-<profile>.log`)
- launchd stderr: suppressed

## Version compatibility

The macOS app checks the gateway version against its own version. If they're
incompatible, update the global CLI to match the app version.

## Smoke check

```bash
quiet-core-bot --version

QUIET_CORE_SKIP_CHANNELS=1 \
QUIET_CORE_SKIP_CANVAS_HOST=1 \
quiet-core-bot gateway --port 18999 --bind loopback
```

Then:

```bash
quiet-core-bot gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```

## Related

- [macOS app](/platforms/macos)
- [Gateway runbook](/gateway)
