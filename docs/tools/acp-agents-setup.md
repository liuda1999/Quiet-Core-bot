---
summary: "Setting up ACP agents: acpx harness config, plugin setup, permissions"
read_when:
  - Installing or configuring the acpx harness for Claude Code / Codex / Gemini CLI
  - Enabling the plugin-tools or Quiet Core bot-tools MCP bridge
  - Configuring ACP permission modes
title: "ACP agents — setup"
---

For the overview, operator runbook, and concepts, see [ACP agents](/tools/acp-agents).

The sections below cover acpx harness config, plugin setup for the MCP bridges, and permission configuration.

Use this page only when you are setting up the ACP/acpx route. For native Codex
app-server runtime config, use [Codex harness](/plugins/codex-harness). For
OpenAI API keys or Codex OAuth model-provider config, use
[OpenAI](/providers/openai).

Codex has two Quiet Core bot routes:

| Route                      | Config/command                                         | Setup page                              |
| -------------------------- | ------------------------------------------------------ | --------------------------------------- |
| Native Codex app-server    | `/codex ...`, `openai/gpt-*` agent refs                | [Codex harness](/plugins/codex-harness) |
| Explicit Codex ACP adapter | `/acp spawn codex`, `runtime: "acp", agentId: "codex"` | This page                               |

Prefer the native route unless you explicitly need ACP/acpx behavior.

## acpx harness support (current)

Current acpx built-in harness aliases:

- `claude`
- `codex`
- `copilot`
- `cursor` (Cursor CLI: `cursor-agent acp`)
- `droid`
- `gemini`
- `iflow`
- `kilocode`
- `kimi`
- `kiro`
- `quiet-core-bot`
- `opencode`
- `qwen`

When Quiet Core bot uses the acpx backend, prefer these values for `agentId` unless your acpx config defines custom agent aliases.
If your local Cursor install still exposes ACP as `agent acp`, override the `cursor` agent command in your acpx config instead of changing the built-in default.

Direct acpx CLI usage can also target arbitrary adapters via `--agent <command>`, but that raw escape hatch is an acpx CLI feature (not the normal Quiet Core bot `agentId` path).

Model control is adapter-capability dependent. Codex ACP model refs are
normalized by Quiet Core bot before startup. Other harnesses need ACP `models` plus
`session/set_model` support; if a harness exposes neither that ACP capability
nor its own startup model flag, Quiet Core bot/acpx cannot force a model selection.

## Required config

Core ACP baseline:

```json5
{
  acp: {
    enabled: true,
    // Optional. Default is true; set false to pause ACP dispatch while keeping /acp controls.
    dispatch: { enabled: true },
    backend: "acpx",
    defaultAgent: "codex",
    allowedAgents: [
      "claude",
      "codex",
      "copilot",
      "cursor",
      "droid",
      "gemini",
      "iflow",
      "kilocode",
      "kimi",
      "kiro",
      "quiet-core-bot",
      "opencode",
      "quiet-core-bot",
      "qwen",
    ],
    maxConcurrentSessions: 8,
    stream: {
      coalesceIdleMs: 300,
      maxChunkChars: 1200,
    },
    runtime: {
      ttlMinutes: 120,
    },
  },
}
```

Thread binding config is channel-adapter specific. Example for Discord:

```json5
{
  session: {
    threadBindings: {
      enabled: true,
      idleHours: 24,
      maxAgeHours: 0,
    },
  },
  channels: {
    discord: {
      threadBindings: {
        enabled: true,
        spawnSessions: true,
      },
    },
  },
}
```

If thread-bound ACP spawn does not work, verify the adapter feature flag first:

- Discord: `channels.discord.threadBindings.spawnSessions=true`

Current-conversation binds do not require child-thread creation. They require an active conversation context and a channel adapter that exposes ACP conversation bindings.

See [Configuration Reference](/gateway/configuration-reference).

## Plugin setup for acpx backend

Packaged installs use the official `@quiet-core/acpx` runtime plugin for ACP.
Install and enable it before using ACP harness sessions:

```bash
quiet-core-bot plugins install @quiet-core/acpx
quiet-core-bot config set plugins.entries.acpx.enabled true
```

Source checkouts can also use the local workspace plugin after `pnpm install`.

Start with:

```text
/acp doctor
```

If you disabled `acpx`, denied it via `plugins.allow` / `plugins.deny`, or want
to switch back to the packaged plugin, use the explicit package path:

```bash
quiet-core-bot plugins install @quiet-core/acpx
quiet-core-bot config set plugins.entries.acpx.enabled true
```

Local workspace install during development:

```bash
quiet-core-bot plugins install ./path/to/local/acpx-plugin
```

Then verify backend health:

```text
/acp doctor
```

### acpx command and version configuration

By default, the `acpx` plugin registers the embedded ACP backend during Gateway
startup and waits for the embedded runtime startup probe before the gateway
`ready` signal. Set `QUIET_CORE_ACPX_RUNTIME_STARTUP_PROBE=0` or
`QUIET_CORE_SKIP_ACPX_RUNTIME_PROBE=1` only for scripts or environments that
intentionally keep the startup probe disabled. Run `/acp doctor` for an explicit
on-demand probe.

Override the command or version in plugin config:

```json
{
  "plugins": {
    "entries": {
      "acpx": {
        "enabled": true,
        "config": {
          "command": "../acpx/dist/cli.js",
          "expectedVersion": "any"
        }
      }
    }
  }
}
```

- `command` accepts an absolute path, relative path (resolved from the Quiet Core bot workspace), or command name.
- `expectedVersion: "any"` disables strict version matching.
- Custom `command` paths disable plugin-local auto-install.

Override an individual ACP agent command with structured arguments when a path
or flag value should remain one argv token:

```json
{
  "plugins": {
    "entries": {
      "acpx": {
        "enabled": true,
        "config": {
          "agents": {
            "claude": {
              "command": "node",
              "args": ["/path/to/custom adapter.mjs", "--verbose"]
            }
          }
        }
      }
    }
  }
}
```

- `agents.<id>.command` is the executable or existing command string for that ACP agent.
- `agents.<id>.args` is optional. Each array item is shell-quoted before Quiet Core bot passes it through the current acpx command-string registry.

See [Plugins](/tools/plugin).

### Automatic dependency install

When you install Quiet Core bot globally via npm (`npm install -g quiet-core-bot` — note: the npm package is **not published yet**), the acpx
runtime dependencies (platform-specific binaries) are installed automatically
via a postinstall hook. If the automatic install fails, the gateway still starts
normally and reports the missing dependency through `quiet-core-bot acp doctor`.

### Plugin tools MCP bridge

By default, ACPX sessions do **not** expose Quiet Core bot plugin-registered tools to
the ACP harness.

If you want ACP agents such as Codex or Claude Code to call installed
Quiet Core bot plugin tools such as memory recall/store, enable the dedicated bridge:

```bash
quiet-core-bot config set plugins.entries.acpx.config.pluginToolsMcpBridge true
```

What this does:

- Injects a built-in MCP server named `quiet-core-bot-plugin-tools` into ACPX session
  bootstrap.
- Exposes plugin tools already registered by installed and enabled Quiet Core bot
  plugins.
- Keeps the feature explicit and default-off.

Security and trust notes:

- This expands the ACP harness tool surface.
- ACP agents get access only to plugin tools already active in the gateway.
- Treat this as the same trust boundary as letting those plugins execute in
  Quiet Core bot itself.
- Review installed plugins before enabling it.

Custom `mcpServers` still work as before. The built-in plugin-tools bridge is an
additional opt-in convenience, not a replacement for generic MCP server config.

### Quiet Core bot tools MCP bridge

By default, ACPX sessions also do **not** expose built-in Quiet Core bot tools through
MCP. Enable the separate core-tools bridge when an ACP agent needs selected
built-in tools such as `cron`:

```bash
quiet-core-bot config set plugins.entries.acpx.config.openClawToolsMcpBridge true
```

What this does:

- Injects a built-in MCP server named `quiet-core-bot-tools` into ACPX session
  bootstrap.
- Exposes selected built-in Quiet Core bot tools. The initial server exposes `cron`.
- Keeps core-tool exposure explicit and default-off.

### Runtime operation timeout configuration

The `acpx` plugin gives embedded runtime startup and control operations 120
seconds by default. This gives slower harnesses such as Gemini CLI enough time
to complete ACP startup and initialization. Override it if your host needs a
different operation limit:

```bash
quiet-core-bot config set plugins.entries.acpx.config.timeoutSeconds 180
```

Runtime turns use Quiet Core bot agent/run timeouts, including `/acp timeout`.
`sessions_spawn` does not accept per-call timeout overrides. Restart the
gateway after changing this value.

### Health probe agent configuration

When `/acp doctor` or the startup probe checks the backend, the bundled `acpx`
plugin probes one harness agent. If `acp.allowedAgents` is set, it defaults to
the first allowed agent; otherwise it defaults to `codex`. If your deployment
needs a different ACP agent for health checks, set the probe agent explicitly:

```bash
quiet-core-bot config set plugins.entries.acpx.config.probeAgent claude
```

Restart the gateway after changing this value.

## Permission configuration

ACP sessions run non-interactively — there is no TTY to approve or deny file-write and shell-exec permission prompts. The acpx plugin provides two config keys that control how permissions are handled:

These ACPX harness permissions are separate from Quiet Core bot exec approvals and separate from CLI-backend vendor bypass flags such as Claude CLI `--permission-mode bypassPermissions`. ACPX `approve-all` is the harness-level break-glass switch for ACP sessions.

For the broader comparison between Quiet Core bot `tools.exec.mode`, Codex Guardian
approvals, and ACPX harness permissions, see
[Permission modes](/tools/permission-modes).

### `permissionMode`

Controls which operations the harness agent can perform without prompting.

| Value           | Behavior                                                  |
| --------------- | --------------------------------------------------------- |
| `approve-all`   | Auto-approve all file writes and shell commands.          |
| `approve-reads` | Auto-approve reads only; writes and exec require prompts. |
| `deny-all`      | Deny all permission prompts.                              |

### `nonInteractivePermissions`

Controls what happens when a permission prompt would be shown but no interactive TTY is available (which is always the case for ACP sessions).

| Value  | Behavior                                                          |
| ------ | ----------------------------------------------------------------- |
| `fail` | Abort the session with `AcpRuntimeError`. **(default)**           |
| `deny` | Silently deny the permission and continue (graceful degradation). |

### Configuration

Set via plugin config:

```bash
quiet-core-bot config set plugins.entries.acpx.config.permissionMode approve-all
quiet-core-bot config set plugins.entries.acpx.config.nonInteractivePermissions fail
```

Restart the gateway after changing these values.

<Warning>
Quiet Core bot defaults to `permissionMode=approve-reads` and `nonInteractivePermissions=fail`. In non-interactive ACP sessions, any write or exec that triggers a permission prompt can fail with `AcpRuntimeError: Permission prompt unavailable in non-interactive mode`.

If you need to restrict permissions, set `nonInteractivePermissions` to `deny` so sessions degrade gracefully instead of crashing.
</Warning>

## Related

- [ACP agents](/tools/acp-agents) — overview, operator runbook, concepts
- [Sub-agents](/tools/subagents)
- [Multi-agent routing](/concepts/multi-agent)
