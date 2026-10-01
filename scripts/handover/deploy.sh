#!/usr/bin/env bash
# QuietCore handover · build + start the gateway with Docker Compose.
#
# Idempotent: safe to re-run after a code change (it rebuilds the image).
# Secrets come from .env (git-ignored, NOT shipped in this package).
#
# Usage:
#   bash scripts/handover/deploy.sh              # build image + start stack
#   bash scripts/handover/deploy.sh --no-build   # start existing image only
#   QUIET_CORE_IMAGE=my/quiet-core-bot:tag bash scripts/handover/deploy.sh
#
# Compose files: docker-compose.yml (+ docker-compose.override.yml when present).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

IMAGE="${QUIET_CORE_IMAGE:-quiet-core-bot:local}"
GATEWAY_PORT="${QUIET_CORE_GATEWAY_PORT:-18789}"
DO_BUILD=1

case "${1:-}" in
  --no-build) DO_BUILD=0 ;;
  --help|-h) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
  "") ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' is required but not found." >&2; exit 1; }
}

require docker
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose v2 plugin is required." >&2; exit 1; }

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Create it from the template first:" >&2
  echo "  cp .env.example .env   # then fill QUIET_CORE_GATEWAY_TOKEN and any provider keys" >&2
  exit 1
fi

COMPOSE_ARGS=(-f docker-compose.yml)
if [ -f docker-compose.override.yml ]; then
  COMPOSE_ARGS+=(-f docker-compose.override.yml)
fi

echo "== validating compose config =="
docker compose "${COMPOSE_ARGS[@]}" config >/dev/null
echo "compose config OK"

if [ "$DO_BUILD" -eq 1 ]; then
  echo "== building image $IMAGE (this builds dist/ inside the image) =="
  QUIET_CORE_IMAGE="$IMAGE" docker compose "${COMPOSE_ARGS[@]}" build
else
  echo "== skipping build (--no-build); using image $IMAGE =="
fi

echo "== starting stack =="
QUIET_CORE_IMAGE="$IMAGE" docker compose "${COMPOSE_ARGS[@]}" up -d

echo "== waiting for readiness on http://127.0.0.1:${GATEWAY_PORT}/readyz =="
for _ in $(seq 1 60); do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/readyz" >/dev/null 2>&1; then
      echo "gateway is ready"
      docker compose "${COMPOSE_ARGS[@]}" ps
      exit 0
    fi
  else
    break
  fi
  sleep 2
done

echo "WARN: readiness not confirmed within the wait window (curl may be missing). Current state:"
docker compose "${COMPOSE_ARGS[@]}" ps
echo "Inspect logs with: bash scripts/handover/logs.sh"
exit 0
