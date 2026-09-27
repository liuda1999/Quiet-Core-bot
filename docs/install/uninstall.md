---
summary: "Uninstall Quiet Core bot completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Quiet Core bot from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `quiet-core-bot` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
quiet-core-bot uninstall
```

When using the CLI, state removal preserves configured workspace directories unless you also select `--workspace`.

Preview what will be removed (safe):

```bash
quiet-core-bot uninstall --dry-run --all
```

Non-interactive (automation / npx). Use with caution and only after confirming scopes:

```bash
quiet-core-bot uninstall --all --yes --non-interactive
npx -y quiet-core-bot uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
quiet-core-bot gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
quiet-core-bot gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${QUIET_CORE_STATE_DIR:-$HOME/.quiet-core-bot}"
```

If you set `QUIET_CORE_CONFIG_PATH` to a custom location outside the state dir, delete that file too.
If you want to keep a workspace inside the state dir, such as `~/.quiet-core-bot/workspace`, move it aside before running `rm -rf` or delete state contents selectively.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.quiet-core-bot/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g quiet-core-bot
pnpm remove -g quiet-core-bot
bun remove -g quiet-core-bot
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Quiet Core bot.app
```

Notes:

- If you used profiles (`--profile` / `QUIET_CORE_PROFILE`), repeat step 3 for each state dir (defaults are `~/.quiet-core-bot-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `quiet-core-bot` is missing.

### macOS (launchd)

Default label is `ai.quiet-core-bot.gateway` (or `ai.quiet-core-bot.<profile>`; legacy `com.openclaw.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.quiet-core-bot.gateway
rm -f ~/Library/LaunchAgents/ai.quiet-core-bot.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.quiet-core-bot.<profile>`. Remove any legacy `com.openclaw.*` plists if present.

### Linux (systemd user unit)

Default unit name is `quiet-core-bot-gateway.service` (or `quiet-core-bot-gateway-<profile>.service`):

```bash
systemctl --user disable --now quiet-core-bot-gateway.service
rm -f ~/.config/systemd/user/quiet-core-bot-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Quiet Core bot Gateway` (or `Quiet Core bot Gateway (<profile>)`).
The task script lives under your state dir as `gateway.cmd`; current installs may
also create a windowless `gateway.vbs` launcher that Task Scheduler runs instead
of opening `gateway.cmd` directly.

```powershell
schtasks /Delete /F /TN "Quiet Core bot Gateway"
Remove-Item -Force "$env:USERPROFILE\.quiet-core-bot\gateway.cmd" -ErrorAction SilentlyContinue
Remove-Item -Force "$env:USERPROFILE\.quiet-core-bot\gateway.vbs" -ErrorAction SilentlyContinue
```

If you used a profile, delete the matching task name and the `gateway.cmd` /
`gateway.vbs` files under `~\.quiet-core-bot-<profile>`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://openclaw.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g quiet-core-bot@latest`.
Remove it with `npm rm -g quiet-core-bot` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `quiet-core-bot ...` / `bun run quiet-core-bot ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
