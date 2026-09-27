---
summary: "CLI reference for `quiet-core-bot commitments` (inspect and dismiss inferred follow-ups)"
read_when:
  - You want to inspect inferred follow-up commitments
  - You want to dismiss pending check-ins
  - You are auditing what heartbeat may deliver
title: "`quiet-core-bot commitments`"
---

List and manage inferred follow-up commitments.

Commitments are opt-in, short-lived follow-up memories created from
conversation context. See [Inferred commitments](/concepts/commitments) for the
conceptual guide.

With no subcommand, `quiet-core-bot commitments` lists pending commitments.

## Usage

```bash
quiet-core-bot commitments [--all] [--agent <id>] [--status <status>] [--json]
quiet-core-bot commitments list [--all] [--agent <id>] [--status <status>] [--json]
quiet-core-bot commitments dismiss <id...> [--json]
```

## Options

- `--all`: show all statuses instead of only pending commitments.
- `--agent <id>`: filter to one agent id.
- `--status <status>`: filter by status. Values: `pending`, `sent`,
  `dismissed`, `snoozed`, or `expired`.
- `--json`: output machine-readable JSON.

## Examples

List pending commitments:

```bash
quiet-core-bot commitments
```

List every stored commitment:

```bash
quiet-core-bot commitments --all
```

Filter to one agent:

```bash
quiet-core-bot commitments --agent main
```

Find snoozed commitments:

```bash
quiet-core-bot commitments --status snoozed
```

Dismiss one or more commitments:

```bash
quiet-core-bot commitments dismiss cm_abc123 cm_def456
```

Export as JSON:

```bash
quiet-core-bot commitments --all --json
```

## Output

Text output includes:

- commitment id
- status
- kind
- earliest due time
- scope
- suggested check-in text

JSON output also includes the commitment store path and full stored records.

## Related

- [Inferred commitments](/concepts/commitments)
- [Memory overview](/concepts/memory)
- [Heartbeat](/gateway/heartbeat)
- [Scheduled tasks](/automation/cron-jobs)
