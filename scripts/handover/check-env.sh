#!/usr/bin/env bash
# QuietCore handover · environment preflight.
#
# Verifies the toolchain needed to build/deploy this checkout. Read-only: it
# installs nothing and changes no config.
#
# Usage:  bash scripts/handover/check-env.sh [--docker-only] [--source-only]
# Exit:   0 = all hard requirements present, 1 = something required is missing.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIN_NODE_MAJOR=22
MIN_NODE_MINOR=19

MODE="both"
case "${1:-}" in
  --docker-only) MODE="docker" ;;
  --source-only) MODE="source" ;;
  --help|-h)
    sed -n '2,10p' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  "") ;;
  *)
    echo "Unknown option: $1" >&2
    exit 2
    ;;
esac

missing=0
info() { printf '  %s\n' "$*"; }
ok()   { printf '[ OK ]    %s\n' "$*"; }
warn() { printf '[ WARN ]  %s\n' "$*"; }
bad()  { printf '[ MISS ]  %s\n' "$*"; missing=$((missing + 1)); }

echo "QuietCore handover preflight"
echo "repo root: $ROOT_DIR"
echo "mode:      $MODE"
echo

echo "== repository sanity =="
for f in package.json pnpm-lock.yaml pnpm-workspace.yaml quiet-core-bot.mjs Dockerfile docker-compose.yml .env.example HANDOVER.md; do
  if [ -f "$ROOT_DIR/$f" ]; then ok "$f"; else warn "missing: $f (see HANDOVER.md)"; fi
done
echo

echo "== Node.js =="
if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v)"
  NODE_MAJOR="${NODE_V#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
  NODE_REST="${NODE_V#v*.}"; NODE_MINOR="${NODE_REST%%.*}"
  if [ "$NODE_MAJOR" -gt "$MIN_NODE_MAJOR" ] 2>/dev/null || \
     { [ "$NODE_MAJOR" -eq "$MIN_NODE_MAJOR" ] && [ "$NODE_MINOR" -ge "$MIN_NODE_MINOR" ]; } 2>/dev/null; then
    ok "node $NODE_V (>= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} required; Node 24 recommended)"
  else
    bad "node $NODE_V is too old (need >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}; Node 24 recommended)"
  fi
else
  bad "node not found (need >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}; Node 24 recommended)"
fi

if [ "$MODE" != "docker" ]; then
  echo
  echo "== pnpm (source build) =="
  if command -v pnpm >/dev/null 2>&1; then
    ok "pnpm $(pnpm -v 2>/dev/null || echo '?')"
  elif command -v corepack >/dev/null 2>&1; then
    warn "pnpm not on PATH but corepack is present -> run: corepack enable && corepack prepare pnpm@11.2.2 --activate"
  else
    bad "neither pnpm nor corepack found (this repo is a pnpm@11.2.2 workspace)"
  fi
fi

if [ "$MODE" != "source" ]; then
  echo
  echo "== Docker (container deploy) =="
  if command -v docker >/dev/null 2>&1; then
    ok "docker $(docker --version 2>/dev/null || echo '?')"
    if docker compose version >/dev/null 2>&1; then
      ok "docker compose $(docker compose version --short 2>/dev/null || echo '?')"
    else
      bad "docker compose plugin not available (Compose v2 required)"
    fi
    if docker info >/dev/null 2>&1; then
      ok "docker daemon reachable"
    else
      warn "docker daemon not reachable right now (start Docker Desktop / dockerd)"
    fi
  else
    bad "docker not found (install Docker Engine/Desktop with the Compose v2 plugin)"
  fi
fi

echo
echo "== optional tools =="
for t in curl git openssl; do
  if command -v "$t" >/dev/null 2>&1; then ok "$t"; else warn "$t not found (optional; improves diagnostics)"; fi
done

echo
echo "== .env =="
if [ -f "$ROOT_DIR/.env" ]; then
  ok ".env present (secrets are NOT in this package; values must be filled locally)"
  if grep -q '^QUIET_CORE_GATEWAY_TOKEN=$' "$ROOT_DIR/.env" 2>/dev/null; then
    warn "QUIET_CORE_GATEWAY_TOKEN is empty -> the gateway auto-generates one on first start, or set your own (openssl rand -hex 32)"
  fi
else
  warn ".env missing -> copy the template: cp .env.example .env"
fi

echo
if [ "$missing" -gt 0 ]; then
  echo "RESULT: $missing required item(s) missing. Install them, then re-run this script."
  exit 1
fi
echo "RESULT: all required items for mode '$MODE' are present."
exit 0
