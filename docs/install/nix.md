---
summary: "Install Quiet Core bot declaratively with Nix"
read_when:
  - You want reproducible, rollback-able installs
  - You're already using Nix/NixOS/Home Manager
  - You want everything pinned and managed declaratively
title: "Nix"
---

Install Quiet Core bot declaratively with **[nix-openclaw](https://github.com/openclaw/nix-openclaw)** - the first-party, batteries-included Home Manager module.

<Info>
The [nix-openclaw](https://github.com/openclaw/nix-openclaw) repo is the source of truth for Nix installation. This page is a quick overview.
</Info>

## What you get

- Gateway + macOS app + tools (whisper, spotify, cameras) -- all pinned
- Launchd service that survives reboots
- Plugin system with declarative config
- Instant rollback: `home-manager switch --rollback`

## Quick start

<Steps>
  <Step title="Install Determinate Nix">
    If Nix is not already installed, follow the [Determinate Nix installer](https://github.com/DeterminateSystems/nix-installer) instructions.
  </Step>
  <Step title="Create a local flake">
    Use the agent-first template from the nix-openclaw repo:
    ```bash
    mkdir -p ~/code/quiet-core-bot-local
    # Copy templates/agent-first/flake.nix from the nix-openclaw repo
    ```
  </Step>
  <Step title="Configure secrets">
    Set up your messaging bot token and model provider API key. Plain files at `~/.secrets/` work fine.
  </Step>
  <Step title="Fill in template placeholders and switch">
    ```bash
    home-manager switch
    ```
  </Step>
  <Step title="Verify">
    Confirm the launchd service is running and your bot responds to messages.
  </Step>
</Steps>

See the [nix-openclaw README](https://github.com/openclaw/nix-openclaw) for full module options and examples.

## Nix-mode runtime behavior

When `QUIET_CORE_NIX_MODE=1` is set (automatic with nix-openclaw), Quiet Core bot enters a deterministic mode for Nix-managed installs. Other Nix packages can set the same mode; nix-openclaw is the first-party reference.

You can also set it manually:

```bash
export QUIET_CORE_NIX_MODE=1
```

On macOS, the GUI app does not automatically inherit shell environment variables. Enable Nix mode via defaults instead:

```bash
defaults write ai.quiet-core-bot.mac quiet-core-bot.nixMode -bool true
```

### What changes in Nix mode

- Auto-install and self-mutation flows are disabled
- `quiet-core-bot.json` is treated as immutable. Startup-derived defaults stay runtime-only, and config writers such as setup, onboarding, mutating `quiet-core-bot update`, plugin install/update/uninstall/enable, `doctor --fix`, `doctor --generate-gateway-token`, and `quiet-core-bot config set` refuse to edit the file.
- Agents should edit the Nix source instead. For nix-openclaw, use the agent-first [Quick Start](https://github.com/openclaw/nix-openclaw#quick-start) and set config under `programs.quiet-core-bot.config` or `instances.<name>.config`.
- Missing dependencies surface Nix-specific remediation messages
- UI surfaces a read-only Nix mode banner

### Config and state paths

Quiet Core bot reads JSON5 config from `QUIET_CORE_CONFIG_PATH` and stores mutable data in `QUIET_CORE_STATE_DIR`. When running under Nix, set these explicitly to Nix-managed locations so runtime state and config stay out of the immutable store.

| Variable               | Default                                                 |
| ---------------------- | ------------------------------------------------------- |
| `QUIET_CORE_HOME`        | `HOME` / `USERPROFILE` / `os.homedir()`                 |
| `QUIET_CORE_STATE_DIR`   | `~/.quiet-core-bot`                                     |
| `QUIET_CORE_CONFIG_PATH` | `$github.com/openclaw/nix-openclaw/quiet-core-bot.json` |

### Service PATH discovery

The launchd/systemd gateway service auto-discovers Nix-profile binaries so
plugins and tools that shell out to `nix`-installed executables work without
manual PATH setup:

- When `NIX_PROFILES` is set, every entry is added to the service PATH in
  right-to-left precedence (matches Nix shell precedence - rightmost wins).
- When `NIX_PROFILES` is unset, `~/.nix-profile/bin` is added as a fallback.

This applies to both macOS launchd and Linux systemd service environments.

## Related

<CardGroup cols={2}>
  <Card title="nix-openclaw" href="https://github.com/openclaw/nix-openclaw" icon="arrow-up-right-from-square">
    Source-of-truth Home Manager module and full setup guide.
  </Card>
  <Card title="Setup wizard" href="/start/wizard" icon="wand-magic-sparkles">
    Non-Nix CLI setup walkthrough.
  </Card>
  <Card title="Docker" href="/install/docker" icon="docker">
    Containerized setup as a non-Nix alternative.
  </Card>
  <Card title="Updating" href="/install/updating" icon="arrow-up-right-from-square">
    Updating Home Manager-managed installs alongside the package.
  </Card>
</CardGroup>
