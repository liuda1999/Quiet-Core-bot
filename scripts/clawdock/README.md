# ClawDock <!-- omit in toc -->

Stop typing `docker-compose` commands. Just type `clawdock-start`.

Inspired by Simon Willison's [Running OpenClaw in Docker](https://til.simonwillison.net/llms/quiet-core-bot-docker).

- [Quickstart](#quickstart)
- [Available Commands](#available-commands)
  - [Basic Operations](#basic-operations)
  - [Container Access](#container-access)
  - [Web UI \& Devices](#web-ui--devices)
  - [Setup \& Configuration](#setup--configuration)
  - [Maintenance](#maintenance)
  - [Utilities](#utilities)
- [Configuration \& Secrets](#configuration--secrets)
  - [Docker Files](#docker-files)
  - [Config Files](#config-files)
  - [Initial Setup](#initial-setup)
  - [How It Works in Docker](#how-it-works-in-docker)
  - [Env Precedence](#env-precedence)
- [Common Workflows](#common-workflows)
  - [Check Status and Logs](#check-status-and-logs)
  - [Set Up WhatsApp Bot](#set-up-whatsapp-bot)
  - [Troubleshooting Device Pairing](#troubleshooting-device-pairing)
  - [Fix Token Mismatch Issues](#fix-token-mismatch-issues)
  - [Permission Denied](#permission-denied)
- [Requirements](#requirements)
- [Development](#development)

## Quickstart

**Install:**

```bash
mkdir -p ~/.clawdock && curl -sL https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/clawdock/clawdock-helpers.sh -o ~/.clawdock/clawdock-helpers.sh
```

```bash
echo 'source ~/.clawdock/clawdock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

Canonical docs page: https://github.com/liuda1999/Quiet-Core-bot/install/clawdock

If you previously installed ClawDock from `scripts/shell-helpers/clawdock-helpers.sh`, rerun the install command above. The old raw GitHub path has been removed.

**See what you get:**

```bash
clawdock-help
```

On first command, ClawDock auto-detects your OpenClaw directory:

- Checks common paths (`~/quiet-core-bot`, `~/workspace/quiet-core-bot`, etc.)
- If found, asks you to confirm
- Saves to `~/.clawdock/config`

**First time setup:**

```bash
clawdock-start
```

```bash
clawdock-fix-token
```

```bash
clawdock-dashboard
```

If you see "pairing required":

```bash
clawdock-devices
```

And approve the request for the specific device:

```bash
clawdock-approve <request-id>
```

## Available Commands

### Basic Operations

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `clawdock-start`   | Start the gateway               |
| `clawdock-stop`    | Stop the gateway                |
| `clawdock-restart` | Restart the gateway             |
| `clawdock-status`  | Check container status          |
| `clawdock-logs`    | View live logs (follows output) |

### Container Access

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `clawdock-shell`          | Interactive shell inside the gateway container |
| `clawdock-cli <command>`  | Run OpenClaw CLI commands                      |
| `clawdock-exec <command>` | Execute arbitrary commands in the container    |

### Web UI & Devices

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `clawdock-dashboard`    | Open web UI in browser with authentication |
| `clawdock-devices`      | List device pairing requests               |
| `clawdock-approve <id>` | Approve a device pairing request           |

### Setup & Configuration

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `clawdock-fix-token` | Configure gateway authentication token (run once) |

### Maintenance

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `clawdock-update`  | Pull latest, rebuild image, and restart (one command) |
| `clawdock-rebuild` | Rebuild the Docker image only                         |
| `clawdock-clean`   | Remove all containers and volumes (destructive!)      |

### Utilities

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `clawdock-health`      | Run gateway health check                  |
| `clawdock-token`       | Display the gateway authentication token  |
| `clawdock-cd`          | Jump to the OpenClaw project directory    |
| `clawdock-config`      | Open the OpenClaw config directory        |
| `clawdock-show-config` | Print config files with redacted values   |
| `clawdock-workspace`   | Open the workspace directory              |
| `clawdock-help`        | Show all available commands with examples |

## Configuration & Secrets

The Docker setup uses three config files on the host. The container never stores secrets — everything is bind-mounted from local files.

### Docker Files

| File                          | Purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `Dockerfile`                  | Builds the `quiet-core-bot:local` image (Node 22, pnpm, non-root `node` user)        |
| `docker-compose.yml`          | Defines `quiet-core-bot-gateway` and `quiet-core-bot-cli` services, bind-mounts, ports     |
| `docker-compose.override.yml` | Standard Docker Compose overrides — auto-loaded by ClawDock helpers if present |
| `docker-compose.extra.yml`    | Additional overrides — loaded after the standard override if present           |
| `scripts/docker/setup.sh`     | First-time setup — builds image, creates `.env` from `.env.example`            |
| `.env.example`                | Template for `<project>/.env` with all supported vars and docs                 |

### Config Files

| File                        | Purpose                                          | Examples                                                                                                |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `<project>/.env`            | **Docker infra** — image, ports, gateway token   | `QUIET_CORE_GATEWAY_TOKEN`, `QUIET_CORE_IMAGE`, `QUIET_CORE_GATEWAY_PORT`, `QUIET_CORE_AUTH_PROFILE_SECRET_DIR` |
| `~/.quiet-core-bot/.env`          | **Secrets** — API keys and bot tokens            | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`                                             |
| `~/.quiet-core-bot/quiet-core-bot.json` | **Behavior config** — models, channels, policies | Model selection, WhatsApp allowlists, agent settings                                                    |

**Do NOT** put API keys or bot tokens in `quiet-core-bot.json`. Use `~/.quiet-core-bot/.env` for all secrets.

### Initial Setup

`./scripts/docker/setup.sh` handles first-time Docker configuration:

- Builds the `quiet-core-bot:local` image from `Dockerfile`
- Creates `<project>/.env` from `.env.example` with a generated gateway token
- Creates the auth-profile secret key directory
- Sets up `~/.quiet-core-bot` directories if they don't exist

```bash
./scripts/docker/setup.sh
```

After setup, add your API keys:

```bash
vim ~/.quiet-core-bot/.env
```

See `.env.example` for all supported keys.

The `Dockerfile` supports optional build args:

- `QUIET_CORE_IMAGE_APT_PACKAGES` — extra apt packages to install (e.g. `ffmpeg`); also accepts legacy `QUIET_CORE_DOCKER_APT_PACKAGES`
- `QUIET_CORE_IMAGE_PIP_PACKAGES` — extra Python packages to install (e.g. `requests==2.32.5`); pin versions and use only package indexes you trust
- `QUIET_CORE_INSTALL_BROWSER=1` — pre-install Chromium for browser automation (adds ~300MB, but skips the 60-90s Playwright install on each container start)

### How It Works in Docker

`docker-compose.yml` bind-mounts both config and workspace from the host:

```yaml
volumes:
  - ${QUIET_CORE_CONFIG_DIR}:/home/node/.quiet-core-bot
  - ${QUIET_CORE_WORKSPACE_DIR}:/home/node/.quiet-core-bot/workspace
  - ${QUIET_CORE_AUTH_PROFILE_SECRET_DIR}:/home/node/.config/quiet-core-bot
```

This means:

- `~/.quiet-core-bot/.env` is available inside the container at `/home/node/.quiet-core-bot/.env` — OpenClaw loads it automatically as the global env fallback
- `~/.quiet-core-bot/quiet-core-bot.json` is available at `/home/node/.quiet-core-bot/quiet-core-bot.json` — the gateway watches it and hot-reloads most changes
- `~/.quiet-core-bot-auth-profile-secrets` is available at `/home/node/.config/quiet-core-bot` — OpenClaw stores the auth-profile encryption key there
- Downloadable external plugin packages and install records live under the mounted OpenClaw home
- Bundled OpenClaw channel plugins, such as Discord when present in the image,
  should normally load from the image-matched bundled copy. Avoid installing
  pinned `@quiet-core/*` channel packages into the mounted home unless you
  deliberately want an external npm override.
- No need to add API keys to `docker-compose.yml` or configure anything inside the container
- Keys survive `clawdock-update`, `clawdock-rebuild`, and `clawdock-clean` because they live on the host

The project `.env` feeds Docker Compose directly (gateway token, image name, ports). The `~/.quiet-core-bot/.env` feeds the OpenClaw process inside the container.

### Example `~/.quiet-core-bot/.env`

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
```

### Example `<project>/.env`

```bash
QUIET_CORE_CONFIG_DIR=/Users/you/.quiet-core-bot
QUIET_CORE_WORKSPACE_DIR=/Users/you/.quiet-core-bot/workspace
QUIET_CORE_GATEWAY_PORT=18789
QUIET_CORE_BRIDGE_PORT=18790
QUIET_CORE_GATEWAY_BIND=lan
QUIET_CORE_GATEWAY_TOKEN=<generated-by-docker-setup>
QUIET_CORE_AUTH_PROFILE_SECRET_DIR=/Users/you/.quiet-core-bot-auth-profile-secrets
QUIET_CORE_IMAGE=quiet-core-bot:local
```

### Env Precedence

OpenClaw loads env vars in this order (highest wins, never overrides existing):

1. **Process environment** — `docker-compose.yml` `environment:` block (gateway token, session keys)
2. **`.env` in CWD** — project root `.env` (Docker infra vars)
3. **`~/.quiet-core-bot/.env`** — global secrets (API keys, bot tokens)
4. **`quiet-core-bot.json` `env` block** — inline vars, applied only if still missing
5. **Shell env import** — optional login-shell scrape (`QUIET_CORE_LOAD_SHELL_ENV=1`)

## Common Workflows

### Update OpenClaw

> **Important:** `quiet-core-bot update` does not work inside Docker.
> The container runs as a non-root user with a source-built image, so `npm i -g` fails with EACCES.
> Use `clawdock-update` instead — it pulls, rebuilds, and restarts from the host.

```bash
clawdock-update
```

This runs `git pull` → `docker compose build` → `docker compose down/up` in one step.

If you only want to rebuild without pulling:

```bash
clawdock-rebuild && clawdock-stop && clawdock-start
```

### Check Status and Logs

**Restart the gateway:**

```bash
clawdock-restart
```

**Check container status:**

```bash
clawdock-status
```

**View live logs:**

```bash
clawdock-logs
```

### Set Up WhatsApp Bot

**Shell into the container:**

```bash
clawdock-shell
```

**Inside the container, login to WhatsApp:**

```bash
quiet-core-bot channels login --channel whatsapp --verbose
```

Scan the QR code with WhatsApp on your phone.

**Verify connection:**

```bash
quiet-core-bot status
```

### Troubleshooting Device Pairing

**Check for pending pairing requests:**

```bash
clawdock-devices
```

**Copy the Request ID from the "Pending" table, then approve:**

```bash
clawdock-approve <request-id>
```

Then refresh your browser.

### Fix Token Mismatch Issues

If you see "gateway token mismatch" errors:

```bash
clawdock-fix-token
```

This will:

1. Read the token from your `.env` file
2. Configure it in the OpenClaw config
3. Restart the gateway
4. Verify the configuration

### Permission Denied

**Ensure Docker is running and you have permission:**

```bash
docker ps
```

## Requirements

- Docker and Docker Compose installed
- Bash or Zsh shell
- OpenClaw project (run `scripts/docker/setup.sh`)

## Development

**Test with fresh config (mimics first-time install):**

```bash
unset CLAWDOCK_DIR && rm -f ~/.clawdock/config && source scripts/clawdock/clawdock-helpers.sh
```

Then run any command to trigger auto-detect:

```bash
clawdock-start
```
