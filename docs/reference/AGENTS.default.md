---
summary: "Default Quiet Core bot agent instructions and skills roster for the personal assistant setup"
title: "Default AGENTS.md"
read_when:
  - Starting a new Quiet Core bot agent session
  - Enabling or auditing default skills
---

## First run (recommended)

Quiet Core bot uses a dedicated workspace directory for the agent. Default: `~/.quiet-core-bot/workspace` (configurable via `agents.defaults.workspace`).

1. Create the workspace (if it doesn't already exist):

```bash
mkdir -p ~/.quiet-core-bot/workspace
```

2. Copy the default workspace templates into the workspace:

```bash
cp docs/reference/templates/AGENTS.md ~/.quiet-core-bot/workspace/AGENTS.md
cp docs/reference/templates/SOUL.md ~/.quiet-core-bot/workspace/SOUL.md
cp docs/reference/templates/TOOLS.md ~/.quiet-core-bot/workspace/TOOLS.md
```

3. Optional: if you want the personal assistant skill roster, replace AGENTS.md with this file:

```bash
cp docs/reference/AGENTS.default.md ~/.quiet-core-bot/workspace/AGENTS.md
```

4. Optional: choose a different workspace by setting `agents.defaults.workspace` (supports `~`):

```json5
{
  agents: { defaults: { workspace: "~/.quiet-core-bot/workspace" } },
}
```

## Safety defaults

- Don't dump directories or secrets into chat.
- Don't run destructive commands unless explicitly asked.
- Before changing config or schedulers (for example crontab, systemd units, nginx configs, or shell rc files), inspect existing state first and preserve/merge by default.
- Don't send partial/streaming replies to external messaging surfaces (only final replies).

## Existing solutions preflight

Before proposing or building a custom system, feature, workflow, tool, integration, or automation, do a brief check for open-source projects, maintained libraries, existing Quiet Core bot plugins, or free platforms that already solve it well enough. Prefer those when adequate. Build custom only when existing options are unsuitable, too expensive, unmaintained, unsafe, non-compliant, or the user explicitly asks for custom. Avoid paid-service recommendations unless the user explicitly approves spend. Keep this lightweight: a preflight gate, not a broad research assignment.

## Session start (required)

- Read `SOUL.md`, `USER.md`, and today+yesterday in `memory/`.
- Read `MEMORY.md` when present.
- Do it before responding.

## Soul (required)

- `SOUL.md` defines identity, tone, and boundaries. Keep it current.
- If you change `SOUL.md`, tell the user.
- You are a fresh instance each session; continuity lives in these files.

## Shared spaces (recommended)

- You're not the user's voice; be careful in group chats or public channels.
- Don't share private data, contact info, or internal notes.

## Memory system (recommended)

- Daily log: `memory/YYYY-MM-DD.md` (create `memory/` if needed).
- Long-term memory: `MEMORY.md` for durable facts, preferences, and decisions.
- Lowercase `memory.md` is legacy repair input only; do not keep both root files on purpose.
- On session start, read today + yesterday + `MEMORY.md` when present.
- Before writing memory files, read them first; write only concrete updates, never empty placeholders.
- Capture: decisions, preferences, constraints, open loops.
- Avoid secrets unless explicitly requested.

## Tools and skills

- Tools live in skills; follow each skill's `SKILL.md` when you need it.
- Keep environment-specific notes in `TOOLS.md` (Notes for Skills).

## Backup tip (recommended)

If you treat this workspace as the agent's "memory", make it a git repo (ideally private) so `AGENTS.md` and your memory files are backed up.

```bash
cd ~/.quiet-core-bot/workspace
git init
git add AGENTS.md
git commit -m "Add agent workspace"
# Optional: add a private remote + push
```

## What Quiet Core bot does

- Runs a local-first gateway plus an embedded agent so the assistant can read/write chats, fetch context, and run skills on your machine.
- Ships channel plugins such as Matrix, Signal, IRC, Mattermost, Nextcloud Talk, Nostr, Raft, Synology Chat, and ClickClack; enable the ones you want in Settings → Channels.
- Talks to models through local or self-hosted providers (Ollama, LM Studio, vLLM, SGLang, llama.cpp, LiteLLM).
- Direct chats collapse into the agent's `main` session by default; groups stay isolated as `agent:<agentId>:<channel>:group:<id>` (rooms/channels: `agent:<agentId>:<channel>:channel:<id>`); heartbeats keep background tasks alive.

## Core skills (enable in Settings → Skills)

- **mcporter** - List, configure, authenticate, call, and inspect MCP servers/tools over HTTP or stdio.
- **peekaboo** - Capture and automate macOS UI.
- **camsnap** - Capture frames or clips from RTSP/ONVIF cameras.
- **video-frames** - Extract frames or short clips from videos using ffmpeg.
- **diagram-maker** - Create SVG/HTML or Excalidraw diagrams for concepts, architecture, and flows.
- **meme-maker** - Search meme templates, suggest formats, and generate local or hosted image memes.
- **songsee** - Generate spectrograms and feature-panel visualizations from audio.
- **openai-whisper** - Local speech-to-text with the Whisper CLI (no API key).
- **sherpa-onnx-tts** - Local text-to-speech via sherpa-onnx (offline, no cloud).
- **weather** - Current weather and forecasts via `web_fetch` or wttr.in.
- **blogwatcher** - Monitor blogs and RSS/Atom feeds for updates.
- **himalaya** - IMAP/SMTP mail CLI: list, read, search, compose, reply, forward, copy, move, delete.
- **obsidian** - Read, search, create, and edit notes in Obsidian vaults.
- **bear-notes** - Create, search, and manage Bear notes.
- **openhue** - Control Philips Hue lights and scenes.
- **sonoscli** - Control Sonos speakers (discover/status/play/volume/group).
- **blucli** - Play, group, and automate BluOS players.
- **tmux** - Control tmux sessions/panes for interactive CLIs.
- **session-logs** - Search and analyze your own session logs with jq.
- **model-usage** - Summarize local CodexBar cost logs by model.
- **taskflow** - Coordinate multi-step detached tasks as one durable TaskFlow job.
- **taskflow-inbox-triage** - Example TaskFlow pattern for inbox triage and intent routing.
- **spike** - Run throwaway prototypes to validate feasibility and compare approaches.
- **skill-creator** - Create, edit, audit, validate, or restructure AgentSkills and `SKILL.md` files.
- **healthcheck** - Audit and harden hosts: SSH, firewall, updates, exposure, backups, and encryption.
- **node-connect** - Diagnose Android, iOS, or macOS node pairing and connection failures.
- **node-inspect-debugger** - Debug Node.js with `node inspect`, breakpoints, CDP, and profiles.
- **python-debugpy** - Debug Python with pdb, post-mortem inspection, and debugpy remote attach.

## Usage notes

- Prefer the `quiet-core-bot` CLI for scripting and automation.
- Run installs from the Skills tab; it hides the button if a binary is already present.
- Keep heartbeats enabled so the assistant can schedule reminders, monitor inboxes, and trigger camera captures.
- Canvas UI runs full-screen with native overlays. Avoid placing critical controls in the top-left/top-right/bottom edges; add explicit gutters in the layout and don't rely on safe-area insets.
- For browser-driven verification, use `quiet-core-bot browser` (tabs/status/screenshot) with the Quiet Core bot-managed Chrome profile.
- For DOM inspection, use `quiet-core-bot browser eval|query|dom|snapshot` (and `--json`/`--out` when you need machine output).
- For interactions, use `quiet-core-bot browser click|type|hover|drag|select|upload|press|wait|navigate|back|evaluate|run` (click/type require snapshot refs; use `evaluate` for CSS selectors).

## Related

- [Agent workspace](/concepts/agent-workspace)
- [Agent runtime](/concepts/agent)
