---
name: boot-md
description: "Run BOOT.md on gateway startup"
homepage: https://github.com/liuda1999/Quiet-Core-bot/automation/hooks#boot-md
metadata:
  {
    "quiet-core-bot":
      {
        "emoji": "🚀",
        "events": ["gateway:startup"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "Bundled with Quiet Core bot" }],
      },
  }
---

# Boot Checklist Hook

Runs `BOOT.md` at gateway startup for each configured agent scope, if the file exists in that
agent's resolved workspace.
