---
summary: "Redirect: flow commands live under `quiet-core-bot tasks flow`"
read_when:
  - You encounter `quiet-core-bot flows` in older docs or release notes
  - You want a quick TaskFlow inspection reference
title: "Flows (redirect)"
---

# `quiet-core-bot tasks flow`

There is no top-level `quiet-core-bot flows` command. Durable TaskFlow inspection lives under `quiet-core-bot tasks flow`.

## Subcommands

```bash
quiet-core-bot tasks flow list   [--json] [--status <name>]
quiet-core-bot tasks flow show   <lookup> [--json]
quiet-core-bot tasks flow cancel <lookup>
```

| Subcommand | Description                | Arguments / options                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `list`     | List tracked TaskFlows.    | `--json` machine-readable output; `--status <name>` filter (see status values below). |
| `show`     | Show one TaskFlow.         | `<lookup>` flow id or owner key; `--json` machine-readable output.                    |
| `cancel`   | Cancel a running TaskFlow. | `<lookup>` flow id or owner key.                                                      |

`<lookup>` accepts either a flow id (returned by `list` / `show`) or the flow's owner key (the stable identifier the owning subsystem uses to track the flow).

### Status filter values

`--status` on `list` accepts one of:

`queued`, `running`, `waiting`, `blocked`, `succeeded`, `failed`, `cancelled`, `lost`

## Examples

```bash
quiet-core-bot tasks flow list
quiet-core-bot tasks flow list --status running
quiet-core-bot tasks flow list --json
quiet-core-bot tasks flow show flow_abc123
quiet-core-bot tasks flow show flow_abc123 --json
quiet-core-bot tasks flow cancel flow_abc123
```

For full TaskFlow concepts and authoring see [TaskFlow](/automation/taskflow). For the parent `tasks` command see [tasks CLI reference](/cli/tasks).

## Related

- [CLI reference](/cli)
- [Automation](/automation)
- [TaskFlow](/automation/taskflow)
