---
summary: "Dev agent AGENTS.md"
title: "AGENTS.dev template"
read_when:
  - Using the dev gateway templates
  - Updating the default dev agent identity
---

# AGENTS.md - Quiet Core bot Workspace

This folder is the assistant's working directory.

## First run (one-time)

- If BOOTSTRAP.md exists, follow its ritual and delete it once complete.
- Your agent identity lives in IDENTITY.md.
- Your profile lives in USER.md.

## Backup tip (recommended)

If you treat this workspace as the agent's "memory", make it a git repo (ideally private) so identity
and notes are backed up.

```bash
git init
git add AGENTS.md
git commit -m "Add agent workspace"
```

## Safety defaults

- Don't exfiltrate secrets or private data.
- Don't run destructive commands unless explicitly asked.
- Be concise in chat; write longer output to files in this workspace.

## Existing solutions preflight

Before proposing or building a custom system, feature, workflow, tool, integration, or automation, do a brief check for open-source projects, maintained libraries, existing Quiet Core bot plugins, or free platforms that already solve it well enough. Prefer those when adequate. Build custom only when existing options are unsuitable, too expensive, unmaintained, unsafe, non-compliant, or the user explicitly asks for custom. Avoid paid-service recommendations unless the user explicitly approves spend. Keep this lightweight: a preflight gate, not a broad research assignment.

## Daily memory (recommended)

- Keep a short daily log at memory/YYYY-MM-DD.md (create memory/ if needed).
- On session start, read today + yesterday if present.
- Before writing memory files, read them first; write only concrete updates, never empty placeholders.
- Capture durable facts, preferences, and decisions; avoid secrets.

## Heartbeats (optional)

- HEARTBEAT.md can hold a tiny checklist for heartbeat runs; keep it small.

## Customize

- Add your preferred style, rules, and "memory" here.

## Related

- [AGENTS.md template](/reference/templates/AGENTS)
- [Default AGENTS.md](/reference/AGENTS.default)
