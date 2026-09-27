---
summary: "CLI reference for `quiet-core-bot approvals` and `quiet-core-bot exec-policy`"
read_when:
  - You want to edit exec approvals from the CLI
  - You need to manage allowlists on gateway or node hosts
  - You need to list or resolve pending approval requests without the Control UI
title: "Approvals"
---

# `quiet-core-bot approvals`

Manage exec approvals for the **local host**, **gateway host**, or a **node host**.
By default, commands target the local approvals file on disk. Use `--gateway` to target the gateway, or `--node` to target a specific node.

Alias: `quiet-core-bot exec-approvals`

Related:

- Exec approvals: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## `quiet-core-bot exec-policy`

`quiet-core-bot exec-policy` is the local convenience command for keeping the requested
`tools.exec.*` config and the local host approvals file aligned in one step.

Use it when you want to:

- inspect the local requested policy, host approvals file, and effective merge
- apply a local preset such as YOLO or deny-all
- synchronize local `tools.exec.*` and the local host approvals file

Examples:

```bash
quiet-core-bot exec-policy show
quiet-core-bot exec-policy show --json

quiet-core-bot exec-policy preset yolo
quiet-core-bot exec-policy preset cautious --json

quiet-core-bot exec-policy set --host gateway --security full --ask off --ask-fallback full
```

Output modes:

- no `--json`: prints the human-readable table view
- `--json`: prints machine-readable structured output

Current scope:

- `exec-policy` is **local-only**
- it updates the local config file and the local approvals file together
- it does **not** push policy to the gateway host or a node host
- `--host node` is rejected in this command because node exec approvals are fetched from the node at runtime and must be managed through node-targeted approvals commands instead
- `quiet-core-bot exec-policy show` marks `host=node` scopes as node-managed at runtime instead of deriving an effective policy from the local approvals file

If you need to edit remote host approvals directly, keep using `quiet-core-bot approvals set --gateway`
or `quiet-core-bot approvals set --node <id|name|ip>`.

## Common commands

```bash
quiet-core-bot approvals get
quiet-core-bot approvals get --node <id|name|ip>
quiet-core-bot approvals get --gateway
```

`quiet-core-bot approvals get` now shows the effective exec policy for local, gateway, and node targets:

- requested `tools.exec` policy
- host approvals-file policy
- effective result after precedence rules are applied

Precedence is intentional:

- the host approvals file is the enforceable source of truth
- requested `tools.exec` policy can narrow or broaden intent, but the effective result is still derived from the host rules
- `--node` combines the node host approvals file with gateway `tools.exec` policy, because both still apply at runtime
- if gateway config is unavailable, the CLI falls back to the node approvals snapshot and notes that the final runtime policy could not be computed

## Pending requests and manual resolution

`get`/`set`/`allowlist` edit approval **state**. To act on requests that are already
waiting for a decision, use the pending-approval commands. They call the running
Gateway over `exec.approval.list` / `exec.approval.resolve` (scope
`operator.approvals`) instead of touching an approvals file:

```bash
quiet-core-bot approvals pending
quiet-core-bot approvals pending --session agent:main:incident-42
quiet-core-bot approvals pending --json

quiet-core-bot approvals approve <id>
quiet-core-bot approvals approve <id> --always
quiet-core-bot approvals deny <id>
```

- `pending` prints the requests currently waiting, with the id, host, command,
  session, and time until expiry, followed by the resolve commands. Ids are shown
  truncated to 8 characters; `approve`/`deny` accept that short form as a prefix.
  Use the full id when a prefix is ambiguous.
- `approve` records `allow-once` by default; `--always` records `allow-always`.
  The Gateway rejects `allow-always` when the effective policy requires approval
  every time — the command then exits non-zero and prints that reason.
- `deny` records `deny`.

This is the supported entry point on hosts with **no approval UI** (pure CLI,
unattended or scheduled runs, scripts). It is equivalent to
`quiet-core-bot gateway call exec.approval.resolve '{"id":"…","decision":"allow-once"}'`
without the JSON quoting, and to what the Control UI and macOS app do.

When `quiet-core-bot agent` ends a turn while a request is still pending, the CLI reports
the block and points at these commands, for example:

```
Blocked on 1 pending exec approval(s) for agent:main:incident-42: 54d8b109
List with: quiet-core-bot approvals pending   Resolve with: quiet-core-bot approvals approve <id> | quiet-core-bot approvals deny <id>
```

Requests expire after 30 minutes by default. Once expired they no longer appear in
`pending`, and the blocked exec call resolves through the configured `askFallback`
(default `deny`). See [Exec approvals](/tools/exec-approvals).

## Replace approvals from a file

```bash
quiet-core-bot approvals set --file ./exec-approvals.json
quiet-core-bot approvals set --stdin <<'EOF'
{ version: 1, defaults: { security: "full", ask: "off", askFallback: "full" } }
EOF
quiet-core-bot approvals set --node <id|name|ip> --file ./exec-approvals.json
quiet-core-bot approvals set --gateway --file ./exec-approvals.json
```

`set` accepts JSON5, not only strict JSON. Use either `--file` or `--stdin`, not both.

## "Never prompt" / YOLO example

For a host that should never stop on exec approvals, set the host approvals defaults to `full` + `off`:

```bash
quiet-core-bot approvals set --stdin <<'EOF'
{
  version: 1,
  defaults: {
    security: "full",
    ask: "off",
    askFallback: "full"
  }
}
EOF
```

Node variant:

```bash
quiet-core-bot approvals set --node <id|name|ip> --stdin <<'EOF'
{
  version: 1,
  defaults: {
    security: "full",
    ask: "off",
    askFallback: "full"
  }
}
EOF
```

This changes the **host approvals file** only. To keep the requested Quiet Core bot policy aligned, also set:

```bash
quiet-core-bot config set tools.exec.host gateway
quiet-core-bot config set tools.exec.security full
quiet-core-bot config set tools.exec.ask off
```

Why `tools.exec.host=gateway` in this example:

- `host=auto` still means "sandbox when available, otherwise gateway".
- YOLO is about approvals, not routing.
- If you want host exec even when a sandbox is configured, make the host choice explicit with `gateway` or `/exec host=gateway`.

Omitted `askFallback` defaults to `deny`. Set `askFallback: "full"`
explicitly when upgrading a no-UI host that should keep never-prompt behavior.

Local shortcut:

```bash
quiet-core-bot exec-policy preset yolo
```

That local shortcut updates both the requested local `tools.exec.*` config and the
local approvals defaults together. It is equivalent in intent to the manual two-step
setup above, but only for the local machine.

## Allowlist helpers

```bash
quiet-core-bot approvals allowlist add "~/Projects/**/bin/rg"
quiet-core-bot approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
quiet-core-bot approvals allowlist add --agent "*" "/usr/bin/uname"

quiet-core-bot approvals allowlist remove "~/Projects/**/bin/rg"
```

## Common options

`get`, `set`, and `allowlist add|remove` all support:

- `--node <id|name|ip>`
- `--gateway`
- shared node RPC options: `--url`, `--token`, `--timeout`, `--json`

Targeting notes:

- no target flags means the local approvals file on disk
- `--gateway` targets the gateway host approvals file
- `--node` targets one node host after resolving id, name, IP, or id prefix

`allowlist add|remove` also supports:

- `--agent <id>` (defaults to `*`)

`pending`, `approve`, and `deny` target the running Gateway, so they take the shared
Gateway RPC options (`--url`, `--token`, `--timeout`, `--json`) but not
`--gateway`/`--node`; `pending` additionally takes `--session <key>` to filter by
session key.

## Notes

- `--node` uses the same resolver as `quiet-core-bot nodes` (id, name, ip, or id prefix).
- `--agent` defaults to `"*"`, which applies to all agents.
- The node host must advertise `system.execApprovals.get/set` (macOS app or headless node host).
- Approvals files are stored per host in the Quiet Core bot state dir
  (`$QUIET_CORE_STATE_DIR/exec-approvals.json`, or
  `~/.quiet-core-bot/exec-approvals.json` when the variable is unset).

## Related

- [CLI reference](/cli)
- [Exec approvals](/tools/exec-approvals)
