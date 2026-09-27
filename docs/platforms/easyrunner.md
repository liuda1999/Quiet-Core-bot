---
summary: "Run the Quiet Core bot Gateway on EasyRunner with Podman and Caddy"
read_when:
  - Deploying Quiet Core bot on EasyRunner
  - Running the Gateway behind EasyRunner's Caddy proxy
  - Choosing persistent volumes and auth for a hosted Gateway
title: "EasyRunner"
---

EasyRunner can host the Quiet Core bot Gateway as a small containerized app behind its
Caddy proxy. This guide assumes an EasyRunner host that runs Podman-compatible
Compose apps and exposes HTTPS through Caddy.

## Before you begin

- An EasyRunner server with a domain routed to it.
- A built or published Quiet Core bot container image.
- A persistent config volume for `/home/node/.quiet-core-bot`.
- A persistent workspace volume for `/workspace`.
- A strong Gateway token or password.

Keep device auth enabled when possible. If your reverse proxy deployment cannot
carry device identity correctly, fix trusted-proxy settings first; use
dangerous auth bypasses only for a fully private, operator-controlled network.

## Compose app

Create an EasyRunner app with a Compose file shaped like this:

```yaml
services:
  quiet-core-bot:
    image: ghcr.io/liuda1999/quiet-core-bot:latest
    restart: unless-stopped
    environment:
      QUIET_CORE_GATEWAY_TOKEN: ${QUIET_CORE_GATEWAY_TOKEN}
      QUIET_CORE_HOME: /home/node
      QUIET_CORE_STATE_DIR: /home/node/.quiet-core-bot
      QUIET_CORE_CONFIG_PATH: /home/node/.quiet-core-bot/quiet-core-bot.json
      QUIET_CORE_WORKSPACE_DIR: /workspace
    volumes:
      - quiet-core-bot-config:/home/node/.quiet-core-bot
      - quiet-core-bot-workspace:/workspace
    labels:
      caddy: quiet-core-bot.example.com
      caddy.reverse_proxy: "{{upstreams 1455}}"
    command: ["quiet-core-bot", "gateway", "--bind", "lan", "--port", "1455"]

volumes:
  quiet-core-bot-config:
  quiet-core-bot-workspace:
```

Replace `quiet-core-bot.example.com` with your Gateway hostname. Store
`QUIET_CORE_GATEWAY_TOKEN` in EasyRunner's secret/environment manager instead of
committing it to the app definition.

## Configure Quiet Core bot

Inside the persistent config volume, keep the Gateway reachable only through
the proxy and require auth:

```json5
{
  gateway: {
    bind: "lan",
    port: 1455,
    auth: {
      token: "${QUIET_CORE_GATEWAY_TOKEN}",
    },
  },
}
```

If Caddy terminates TLS for the Gateway, configure trusted proxy settings for
the exact proxy path rather than disabling auth checks globally. See
[Trusted proxy auth](/gateway/trusted-proxy-auth).

## Verify

From your workstation:

```bash
quiet-core-bot gateway probe --url https://quiet-core-bot.example.com --token <token>
quiet-core-bot gateway status --url https://quiet-core-bot.example.com --token <token>
```

From the EasyRunner host, check the app logs for a listening Gateway and no
startup SecretRef, plugin, or channel auth failures.

## Updates and backups

- Pull or build the new Quiet Core bot image, then redeploy the EasyRunner app.
- Back up the `quiet-core-bot-config` volume before updates.
- Back up `quiet-core-bot-workspace` if agents write durable project data there.
- Run `quiet-core-bot doctor` after major updates to catch config migrations and
  service warnings.

## Troubleshooting

- `gateway probe` cannot connect: confirm the Caddy hostname points at the app
  and that the container listens on `0.0.0.0:1455`.
- Auth fails: rotate the token in EasyRunner secrets and the local client
  command together.
- Files are root-owned after restore: repair the mounted volumes so the
  container user can write `/home/node/.quiet-core-bot` and `/workspace`.
- Browser or channel plugins fail: check whether the required external
  binaries, network egress, and mounted credentials are available inside the
  container.
