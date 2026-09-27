---
summary: "CLI reference for `quiet-core-bot agents` (list/add/delete/bindings/bind/unbind/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "Agents"
---

# `quiet-core-bot agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- [Multi-agent routing](/concepts/multi-agent)
- [Agent workspace](/concepts/agent-workspace)
- [Skills config](/tools/skills-config): skill visibility configuration.

## Examples

```bash
quiet-core-bot agents list
quiet-core-bot agents list --bindings
quiet-core-bot agents add work --workspace ~/.quiet-core-bot/workspace-work
quiet-core-bot agents add work --workspace ~/.quiet-core-bot/workspace-work --bind telegram:*
quiet-core-bot agents add ops --workspace ~/.quiet-core-bot/workspace-ops --bind telegram:ops --non-interactive
quiet-core-bot agents bindings
quiet-core-bot agents bind --agent work --bind telegram:ops
quiet-core-bot agents unbind --agent work --bind telegram:ops
quiet-core-bot agents set-identity --workspace ~/.quiet-core-bot/workspace --from-identity
quiet-core-bot agents set-identity --agent main --avatar avatars/quiet-core-bot.png
quiet-core-bot agents delete work
```

## Routing bindings

Use routing bindings to pin inbound channel traffic to a specific agent.

If you also want different visible skills per agent, configure `agents.defaults.skills` and `agents.list[].skills` in `quiet-core-bot.json`. See [Skills config](/tools/skills-config) and [Configuration reference](/gateway/config-agents#agents-defaults-skills).

List bindings:

```bash
quiet-core-bot agents bindings
quiet-core-bot agents bindings --agent work
quiet-core-bot agents bindings --json
```

Add bindings:

```bash
quiet-core-bot agents bind --agent work --bind telegram:ops --bind discord:guild-a
```

You can also add bindings when creating an agent:

```bash
quiet-core-bot agents add work --workspace ~/.quiet-core-bot/workspace-work --bind telegram:* --bind discord:*
```

If you omit `accountId` (`--bind <channel>`), Quiet Core bot resolves it from plugin setup hooks, forced account binding, or the channel's configured account count.

If you omit `--agent` for `bind` or `unbind`, Quiet Core bot targets the current default agent.

### `--bind` format

| Format                       | Meaning                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `--bind <channel>:*`         | Match all accounts on the channel.                                                                |
| `--bind <channel>:<account>` | Match one account.                                                                                |
| `--bind <channel>`           | Match the default account only unless the CLI can safely resolve a plugin-specific account scope. |

### Binding scope behavior

- A stored binding without `accountId` matches the channel default account only.
- `accountId: "*"` is the channel-wide fallback (all accounts) and is less specific than an explicit account binding.
- If the same agent already has a matching channel binding without `accountId`, and you later bind with an explicit or resolved `accountId`, Quiet Core bot upgrades that existing binding in place instead of adding a duplicate.

Examples:

```bash
# match all accounts on the channel
quiet-core-bot agents bind --agent work --bind telegram:*

# match a specific account
quiet-core-bot agents bind --agent work --bind telegram:ops

# initial channel-only binding
quiet-core-bot agents bind --agent work --bind telegram

# later upgrade to account-scoped binding
quiet-core-bot agents bind --agent work --bind telegram:alerts
```

After the upgrade, routing for that binding is scoped to `telegram:alerts`. If you also want default-account routing, add it explicitly (for example `--bind telegram:default`).

Remove bindings:

```bash
quiet-core-bot agents unbind --agent work --bind telegram:ops
quiet-core-bot agents unbind --agent work --all
```

`unbind` accepts either `--all` or one or more `--bind` values, not both.

## Command surface

### `agents`

Running `quiet-core-bot agents` with no subcommand is equivalent to `quiet-core-bot agents list`.

### `agents list`

Options:

- `--json`
- `--bindings`: include full routing rules, not only per-agent counts/summaries

### `agents add [name]`

Options:

- `--workspace <dir>`
- `--model <id>`
- `--agent-dir <dir>`
- `--bind <channel[:accountId]>` (repeatable)
- `--non-interactive`
- `--json`

Notes:

- Passing any explicit add flags switches the command into the non-interactive path.
- Non-interactive mode requires both an agent name and `--workspace`.
- `main` is reserved and cannot be used as the new agent id.
- In interactive mode, auth seeding copies only portable static profiles
  (`api_key` and static `token` by default). OAuth refresh-token profiles remain
  available only by read-through inheritance from the real `main` agent store.
  If the configured default agent is not `main`, sign in separately for OAuth
  profiles on the new agent.

### `agents bindings`

Options:

- `--agent <id>`
- `--json`

### `agents bind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--json`

### `agents unbind`

Options:

- `--agent <id>` (defaults to the current default agent)
- `--bind <channel[:accountId]>` (repeatable)
- `--all`
- `--json`

### `agents delete <id>`

Options:

- `--force`
- `--json`

Notes:

- `main` cannot be deleted.
- Without `--force`, interactive confirmation is required.
- Workspace, agent state, and session transcript directories are moved to Trash, not hard-deleted.
- When the Gateway is reachable, deletion is sent through the Gateway so config and session-store cleanup share the same writer as runtime traffic. If the Gateway cannot be reached, the CLI falls back to the offline local path.
- If another agent's workspace is the same path, inside this workspace, or contains this workspace,
  the workspace is retained and `--json` reports `workspaceRetained`,
  `workspaceRetainedReason`, and `workspaceSharedWith`.

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.quiet-core-bot/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Options:

- `--agent <id>`
- `--workspace <dir>`
- `--identity-file <path>`
- `--from-identity`
- `--name <name>`
- `--theme <theme>`
- `--emoji <emoji>`
- `--avatar <value>`
- `--json`

Notes:

- `--agent` or `--workspace` can be used to select the target agent.
- If you rely on `--workspace` and multiple agents share that workspace, the command fails and asks you to pass `--agent`.
- Local workspace-relative avatar image files are limited to 2 MB. HTTP(S) URLs and `data:` URIs are not checked with the local file-size limit.
- When no explicit identity fields are provided, the command reads identity data from `IDENTITY.md`.

Load from `IDENTITY.md`:

```bash
quiet-core-bot agents set-identity --workspace ~/.quiet-core-bot/workspace --from-identity
```

Override fields explicitly:

```bash
quiet-core-bot agents set-identity --agent main --name "Quiet Core bot" --emoji "🐉" --avatar avatars/quiet-core-bot.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Quiet Core bot",
          theme: "space lobster",
          emoji: "🐉",
          avatar: "avatars/quiet-core-bot.png",
        },
      },
    ],
  },
}
```

## Related

- [CLI reference](/cli)
- [Multi-agent routing](/concepts/multi-agent)
- [Agent workspace](/concepts/agent-workspace)
