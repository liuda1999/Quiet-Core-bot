#!/usr/bin/env bash
# OpenClaw handover · start / stop / restart / status for BOTH run modes.
#
# Usage:
#   bash scripts/handover/start.sh  [docker|node]   # default: docker
#   bash scripts/handover/stop.sh   [docker|node]
#   bash scripts/handover/restart.sh [docker|node]
#   bash scripts/handover/status.sh  [docker|node]
#
# docker mode -> docker compose (docker-compose.yml [+ override])
# node mode   -> local Node process using the prebuilt dist/ (run `pnpm build` first)
#
# The active mode is remembered in .handover-run-mode so stop/status know what to
# target without repeating the argument.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

MODE_FILE=".handover-run-mode"
LOG_DIR="${OPENCLAW_LOG_DIR:-$ROOT_DIR/.handover-logs}"
PID_FILE="$LOG_DIR/gateway.pid"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"

compose_args() {
  local args=(-f docker-compose.yml)
  [ -f docker-compose.override.yml ] && args+=(-f docker-compose.override.yml)
  printf '%s\n' "${args[@]}"
}

resolve_mode() {
  if [ -n "${1:-}" ]; then echo "$1"; return; fi
  if [ -f "$MODE_FILE" ]; then cat "$MODE_FILE"; return; fi
  echo "docker"
}

cmd="${1:-}"
mode="$(resolve_mode "${2:-}")"

require_docker() {
  command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found." >&2; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose v2 required." >&2; exit 1; }
}

do_start() {
  case "$mode" in
    docker)
      require_docker
      [ -f .env ] || { echo "ERROR: .env missing (cp .env.example .env)." >&2; exit 1; }
      mapfile -t CA < <(compose_args)
      docker compose "${CA[@]}" up -d
      ;;
    node)
      [ -f dist/index.js ] || { echo "ERROR: dist/index.js missing. Build first: pnpm build" >&2; exit 1; }
      mkdir -p "$LOG_DIR"
      if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "already running (pid $(cat "$PID_FILE"))"; exit 0
      fi
      nohup node dist/index.js gateway --allow-unconfigured --port "$GATEWAY_PORT" \
        >>"$LOG_DIR/gateway.out.log" 2>>"$LOG_DIR/gateway.err.log" &
      echo $! >"$PID_FILE"
      echo "started node gateway (pid $(cat "$PID_FILE")); logs: $LOG_DIR"
      ;;
    *) echo "ERROR: unknown mode '$mode' (use docker|node)" >&2; exit 2 ;;
  esac
  echo "$mode" >"$MODE_FILE"
}

do_stop() {
  case "$mode" in
    docker)
      require_docker
      mapfile -t CA < <(compose_args)
      docker compose "${CA[@]}" down
      ;;
    node)
      if [ -f "$PID_FILE" ]; then
        pid="$(cat "$PID_FILE")"
        if kill -0 "$pid" 2>/dev/null; then kill "$pid" && echo "stopped pid $pid"; else echo "pid $pid not running"; fi
        rm -f "$PID_FILE"
      else
        echo "no pid file; nothing to stop"
      fi
      ;;
    *) echo "ERROR: unknown mode '$mode'" >&2; exit 2 ;;
  esac
}

do_status() {
  case "$mode" in
    docker)
      require_docker
      mapfile -t CA < <(compose_args)
      docker compose "${CA[@]}" ps
      ;;
    node)
      if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "node gateway running (pid $(cat "$PID_FILE"))"
      else
        echo "node gateway not running"
      fi
      ;;
    *) echo "ERROR: unknown mode '$mode'" >&2; exit 2 ;;
  esac
  if command -v curl >/dev/null 2>&1; then
    echo "readyz: $(curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/readyz" 2>/dev/null || echo 'unreachable')"
  fi
}

case "$cmd" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  status)  do_status ;;
  *) echo "usage: bash scripts/handover/$0 {start|stop|restart|status} [docker|node]" >&2; exit 2 ;;
esac
