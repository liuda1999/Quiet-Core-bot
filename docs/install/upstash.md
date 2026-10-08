---
summary: "Host Quiet Core bot on Upstash Box with keep-alive and SSH tunnel access"
read_when:
  - Deploying Quiet Core bot to Upstash Box
  - You want a managed Linux environment for Quiet Core bot with SSH-tunneled dashboard access
title: "Upstash Box"
---

Run a persistent Quiet Core bot Gateway on Upstash Box, a managed Linux environment
with keep-alive lifecycle support.

Use an SSH tunnel for dashboard access. Do not expose the Gateway port directly
to the public internet.

## Prerequisites

- Upstash account
- Keep-alive Upstash Box
- SSH client on your local machine

## Create a Box

Create a keep-alive Box in the Upstash Console. Note the Box ID, such as
`right-flamingo-14486`, and your Box API key.

Upstash maintains its current Quiet Core bot Box walkthrough at
[Quiet Core bot Setup](https://upstash.com/docs/box/guides/quiet-core-bot-setup).

## Connect with an SSH tunnel

Forward the Quiet Core bot dashboard port to your local machine. Use your Box API key
as the SSH password when prompted:

```bash
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 18789:127.0.0.1:18789 <box-id>@us-east-1.box.upstash.com
```

The keepalive options reduce idle tunnel drops during onboarding.

## Install Quiet Core bot

Inside the Box:

```bash
sudo npm install -g quiet-core-bot
```

> ⚠️ The npm package `quiet-core-bot` is **not published yet**, so this command fails. Build from source or run the installer with `--install-method git`.

## Run onboarding

```bash
quiet-core-bot onboard --install-daemon
```

Follow the prompts. Copy the dashboard URL and token when onboarding finishes.

## Start the Gateway

Configure the Gateway for the Box network and start it in the background:

```bash
quiet-core-bot config set gateway.bind lan
nohup quiet-core-bot gateway > gateway.log 2>&1 &
```

With the SSH tunnel active, open the dashboard URL locally:

```text
http://127.0.0.1:18789/#token=<your-token>
```

## Auto-restart

Set this command as the Box init script so the Gateway restarts when the Box
starts:

```bash
nohup quiet-core-bot gateway > gateway.log 2>&1 &
```

## Troubleshooting

If SSH freezes during onboarding, reconnect with a clean SSH config and
keepalives:

```bash
ssh -F /dev/null -o ControlMaster=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -L 18789:127.0.0.1:18789 <box-id>@us-east-1.box.upstash.com
```

This bypasses stale local `~/.ssh/config` settings and keeps the tunnel active
through idle network periods.

## Related

- [Remote access](/gateway/remote)
- [Gateway security](/gateway/security)
- [Updating Quiet Core bot](/install/updating)
