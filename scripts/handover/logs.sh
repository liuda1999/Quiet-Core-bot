#!/usr/bin/env bash
# OpenClaw handover · show gateway logs (Docker or Node mode).
#
# Usage:
#   bash scripts/handover/logs.sh [docker|node] [--follow] [--tail N]
#
# docker mode -> docker compose logs
# node mode   -> tail of .handover-logs/gateway.{out,err}.log
#
# Gateway log level is controlled by QUIET_CORE_LOG_LEVEL / logging.* in config;
# structured JSON lines go to stderr.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

MODE_FILE=".handover-run-mode"
LOG_DIR="${QUIET_CORE_LOG_DIR:-$ROOT_DIR/.handover-logs}"
TAIL_N=200
FOLLOW=""

mode=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    docker|node) mode="$1" ;;
    --follow|-f) FOLLOW="-f" ;;
    --tail) shift; TAIL_N="${1:-200}" ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$mode" ]; then
  if [ -f "$MODE_FILE" ]; then mode="$(cat "$MODE_FILE")"; else mode="docker"; fi
fi

case "$mode" in
  docker)
    command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found." >&2; exit 1; }
    args=(-f docker-compose.yml)
    [ -f docker-compose.override.yml ] && args+=(-f docker-compose.override.yml)
    exec docker compose "${args[@]}" logs --tail "$TAIL_N" $FOLLOW
    ;;
  node)
    if [ ! -d "$LOG_DIR" ]; then
      echo "No log dir yet ($LOG_DIR). Start with: bash scripts/handover/start.sh node" >&2
      exit 1
    fi
    echo "== $LOG_DIR/gateway.out.log =="
    tail -n "$TAIL_N" "$LOG_DIR/gateway.out.log" 2>/dev/null || true
    echo
    echo "== $LOG_DIR/gateway.err.log =="
    tail -n "$TAIL_N" "$LOG_DIR/gateway.err.log" 2>/dev/null || true
    ;;
  *) echo "ERROR: unknown mode '$mode'" >&2; exit 2 ;;
esac
