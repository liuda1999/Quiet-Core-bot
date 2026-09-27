#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${QUIET_CORE_LIVE_ACP_BIND_AGENTS:-}" && "${QUIET_CORE_LIVE_ACP_BIND_AGENTS}" != "codex" ]]; then
  echo "ERROR: ACP spawn defaults Docker test supports only QUIET_CORE_LIVE_ACP_BIND_AGENTS=codex." >&2
  exit 1
fi

export QUIET_CORE_LIVE_ACP_BIND_AGENTS=codex
export QUIET_CORE_LIVE_ACP_BIND_TEST_FILES="${QUIET_CORE_LIVE_ACP_BIND_TEST_FILES:-src/gateway/gateway-acp-spawn-defaults.live.test.ts}"
export QUIET_CORE_LIVE_ACP_SPAWN_DEFAULTS=1
export QUIET_CORE_LIVE_ACP_SPAWN_DEFAULTS_MODEL="${QUIET_CORE_LIVE_ACP_SPAWN_DEFAULTS_MODEL:-openai/gpt-5.5}"
export QUIET_CORE_LIVE_ACP_SPAWN_DEFAULTS_THINKING="${QUIET_CORE_LIVE_ACP_SPAWN_DEFAULTS_THINKING:-high}"
export QUIET_CORE_LIVE_ACP_BIND_CODEX_MODEL="${QUIET_CORE_LIVE_ACP_BIND_CODEX_MODEL:-gpt-5.5}"

exec bash "$SCRIPT_DIR/test-live-acp-bind-docker.sh"
