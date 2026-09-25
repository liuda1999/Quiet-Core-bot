---
summary: "CLI reference for `quiet-core-bot nodes` (status, pairing, invoke, camera/canvas/screen)"
read_when:
  - You're managing paired nodes (cameras, screen, canvas)
  - You need to approve requests or invoke node commands
title: "Nodes"
---

# `quiet-core-bot nodes`

Manage paired nodes (devices) and invoke node capabilities.

Related:

- Nodes overview: [Nodes](/nodes)
- Camera: [Camera nodes](/nodes/camera)
- Images: [Image nodes](/nodes/images)

Common options:

- `--url`, `--token`, `--timeout`, `--json`

## Common commands

```bash
quiet-core-bot nodes list
quiet-core-bot nodes list --connected
quiet-core-bot nodes list --last-connected 24h
quiet-core-bot nodes pending
quiet-core-bot nodes approve <requestId>
quiet-core-bot nodes reject <requestId>
quiet-core-bot nodes remove --node <id|name|ip>
quiet-core-bot nodes rename --node <id|name|ip> --name <displayName>
quiet-core-bot nodes status
quiet-core-bot nodes status --connected
quiet-core-bot nodes status --last-connected 24h
```

`nodes list` prints pending/paired tables. Paired rows include the most recent connect age (Last Connect).
Use `--connected` to only show currently-connected nodes. Use `--last-connected <duration>` to
filter to nodes that connected within a duration (e.g. `24h`, `7d`).
Use `nodes remove --node <id|name|ip>` to remove a node pairing. For a
device-backed node this revokes the device's `node` role in `devices/paired.json`
and disconnects its node-role sessions (a mixed-role device keeps its row and
only loses the `node` role; a node-only device is deleted); it also clears any
matching legacy gateway-owned node pairing record. `operator.pairing` can remove
non-operator node rows; a device-token caller revoking its own node role on a
mixed-role device additionally needs `operator.admin`.

Approval note:

- `quiet-core-bot nodes pending` only needs pairing scope.
- `gateway.nodes.pairing.autoApproveCidrs` can skip the pending step only for
  explicitly trusted, first-time `role: node` device pairing. It is off by
  default and does not approve upgrades.
- `quiet-core-bot nodes approve <requestId>` inherits extra scope requirements from the
  pending request:
  - commandless request: pairing only
  - non-exec node commands: pairing + write
  - `system.run` / `system.run.prepare` / `system.which`: pairing + admin

## Invoke

```bash
quiet-core-bot nodes invoke --node <id|name|ip> --command <command> --params <json>
```

Invoke flags:

- `--params <json>`: JSON object string (default `{}`).
- `--invoke-timeout <ms>`: node invoke timeout (default `15000`).
- `--idempotency-key <key>`: optional idempotency key.
- `system.run` and `system.run.prepare` are blocked here; use the `exec` tool with `host=node` for shell execution.

For shell execution on a node, use the `exec` tool with `host=node` instead of `quiet-core-bot nodes run`.
The `nodes` CLI is now capability-focused: direct RPC via `nodes invoke`, plus pairing, camera,
screen, location, Canvas, and notifications. Canvas commands are implemented by the bundled experimental Canvas plugin; core keeps a compatibility hook so they remain under `quiet-core-bot nodes canvas`.

## Related

- [CLI reference](/cli)
- [Nodes](/nodes)
