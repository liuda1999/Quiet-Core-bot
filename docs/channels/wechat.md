---
summary: "WeChat channel setup through the external quiet-core-bot-weixin plugin"
read_when:
  - You want to connect Quiet Core bot to WeChat or Weixin
  - You are installing or troubleshooting the quiet-core-bot-weixin channel plugin
  - You need to understand how external channel plugins run beside the Gateway
title: "WeChat"
---

Quiet Core bot connects to WeChat through Tencent's external
`@tencent-weixin/quiet-core-bot-weixin` channel plugin.

Status: external plugin. Direct chats and media are supported. Group chats are not
advertised by the current plugin capability metadata.

## Naming

- **WeChat** is the user-facing name in these docs.
- **Weixin** is the name used by Tencent's package and by the plugin id.
- `quiet-core-bot-weixin` is the Quiet Core bot channel id.
- `@tencent-weixin/quiet-core-bot-weixin` is the npm package.

Use `quiet-core-bot-weixin` in CLI commands and config paths.

## How it works

The WeChat code does not live in the Quiet Core bot core repo. Quiet Core bot provides the
generic channel plugin contract, and the external plugin provides the
WeChat-specific runtime:

1. `quiet-core-bot plugins install` installs `@tencent-weixin/quiet-core-bot-weixin`.
2. The Gateway discovers the plugin manifest and loads the plugin entrypoint.
3. The plugin registers channel id `quiet-core-bot-weixin`.
4. `quiet-core-bot channels login --channel quiet-core-bot-weixin` starts QR login.
5. The plugin stores account credentials under the Quiet Core bot state directory.
6. When the Gateway starts, the plugin starts its Weixin monitor for each
   configured account.
7. Inbound WeChat messages are normalized through the channel contract, routed to
   the selected Quiet Core bot agent, and sent back through the plugin outbound path.

That separation matters: Quiet Core bot core should stay channel-agnostic. WeChat login,
Tencent iLink API calls, media upload/download, context tokens, and account
monitoring are owned by the external plugin.

## Install

Quick install:

```bash
npx -y @tencent-weixin/quiet-core-bot-weixin-cli install
```

Manual install:

```bash
quiet-core-bot plugins install "@tencent-weixin/quiet-core-bot-weixin"
quiet-core-bot config set plugins.entries.quiet-core-bot-weixin.enabled true
```

Restart the Gateway after install:

```bash
quiet-core-bot gateway restart
```

## Login

Run QR login on the same machine that runs the Gateway:

```bash
quiet-core-bot channels login --channel quiet-core-bot-weixin
```

Scan the QR code with WeChat on your phone and confirm the login. The plugin saves
the account token locally after a successful scan.

To add another WeChat account, run the same login command again. For multiple
accounts, isolate direct-message sessions by account, channel, and sender:

```bash
quiet-core-bot config set session.dmScope per-account-channel-peer
```

## Access control

Direct messages use the normal Quiet Core bot pairing and allowlist model for channel
plugins.

Approve new senders:

```bash
quiet-core-bot pairing list quiet-core-bot-weixin
quiet-core-bot pairing approve quiet-core-bot-weixin <CODE>
```

For the full access-control model, see [Pairing](/channels/pairing).

## Compatibility

The plugin checks the host Quiet Core bot version at startup.

| Plugin line | Quiet Core bot version  | npm tag  |
| ----------- | ----------------------- | -------- |
| `2.x`       | `>=2026.3.22`           | `latest` |
| `1.x`       | `>=2026.1.0 <2026.3.22` | `legacy` |

If the plugin reports that your Quiet Core bot version is too old, either update
Quiet Core bot or install the legacy plugin line:

```bash
quiet-core-bot plugins install @tencent-weixin/quiet-core-bot-weixin@legacy
```

## Sidecar process

The WeChat plugin can run helper work beside the Gateway while it monitors the
Tencent iLink API. In issue #68451, that helper path exposed a bug in Quiet Core bot's
generic stale-Gateway cleanup: a child process could try to clean up the parent
Gateway process, causing restart loops under process managers such as systemd.

Current Quiet Core bot startup cleanup excludes the current process and its ancestors,
so a channel helper must not kill the Gateway that launched it. This fix is
generic; it is not a WeChat-specific path in core.

## Troubleshooting

Check install and status:

```bash
quiet-core-bot plugins list
quiet-core-bot channels status --probe
quiet-core-bot --version
```

If the channel shows as installed but does not connect, confirm that the plugin is
enabled and restart:

```bash
quiet-core-bot config set plugins.entries.quiet-core-bot-weixin.enabled true
quiet-core-bot gateway restart
```

If the Gateway restarts repeatedly after enabling WeChat, update both Quiet Core bot and
the plugin:

```bash
npm view @tencent-weixin/quiet-core-bot-weixin version
quiet-core-bot plugins install "@tencent-weixin/quiet-core-bot-weixin" --force
quiet-core-bot gateway restart
```

If startup reports that the installed plugin package `requires compiled runtime
output for TypeScript entry`, the npm package was published without the compiled
JavaScript runtime files Quiet Core bot needs. Update/reinstall after the plugin
publisher ships a fixed package, or temporarily disable/uninstall the plugin.

Temporary disable:

```bash
quiet-core-bot config set plugins.entries.quiet-core-bot-weixin.enabled false
quiet-core-bot gateway restart
```

## Related docs

- Channel overview: [Chat Channels](/channels)
- Pairing: [Pairing](/channels/pairing)
- Channel routing: [Channel Routing](/channels/channel-routing)
- Plugin architecture: [Plugin Architecture](/plugins/architecture)
- Channel plugin SDK: [Channel Plugin SDK](/plugins/sdk-channel-plugins)
- External package: [@tencent-weixin/quiet-core-bot-weixin](https://www.npmjs.com/package/@tencent-weixin/quiet-core-bot-weixin)
