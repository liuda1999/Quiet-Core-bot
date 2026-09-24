#!/usr/bin/env bash
# OpenClaw handover · health probe.
#
# Checks the liveness (/healthz) and readiness (/readyz) endpoints and, when a
# local build/CLI is available, the richer `openclaw health` / `gateway status`
# reports. Read-only.
#
# Usage:
#   bash scripts/handover/check-health.sh
#   OPENCLAW_GATEWAY_PORT=18789 OPENCLAW_GATEWAY_TOKEN=... bash scripts/handover/check-health.sh
#
# Note: /readyz returns the full object only for loopback callers or callers that
# prove gateway auth; unauthenticated remote probes get `{ ready }` only.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

HOST="${OPENCLAW_GATEWAY_HOST:-127.0.0.1}"
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
BASE="http://${HOST}:${PORT}"

FETCH=""
if command -v curl >/dev/null 2>&1; then
  FETCH="curl"
elif command -v wget >/dev/null 2>&1; then
  FETCH="wget"
else
  echo "ERROR: need curl or wget for HTTP probes." >&2
  exit 1
fi

auth_args=()
if [ -n "$TOKEN" ]; then
  if [ "$FETCH" = "curl" ]; then auth_args=(-H "Authorization: Bearer ${TOKEN}"); fi
fi

get() {
  local url="$1"
  if [ "$FETCH" = "curl" ]; then
    curl -fsS --max-time 10 "${auth_args[@]}" "$url"
  else
    if [ -n "$TOKEN" ]; then
      wget -qO- --timeout=10 --header="Authorization: Bearer ${TOKEN}" "$url"
    else
      wget -qO- --timeout=10 "$url"
    fi
  fi
}

fail=0
for path in /healthz /readyz; do
  printf '%-10s %s' "$path" "$BASE$path"
  if out="$(get "$BASE$path" 2>/dev/null)"; then
    printf '  -> %s\n' "${out:0:400}"
  else
    printf '  -> UNREACHABLE\n'
    fail=1
  fi
done

echo
if [ -f dist/index.js ]; then
  echo "== openclaw gateway status =="
  node dist/index.js gateway status 2>&1 | head -n 25 || true
  echo
  echo "== openclaw health =="
  node dist/index.js health 2>&1 | head -n 25 || true
else
  echo "== openclaw CLI checks skipped (dist/index.js not built; run: pnpm build) =="
fi

exit "$fail"
