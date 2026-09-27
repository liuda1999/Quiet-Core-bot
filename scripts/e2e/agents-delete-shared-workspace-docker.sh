#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "quiet-core-bot-agents-delete-shared-workspace-e2e:local" QUIET_CORE_AGENTS_DELETE_SHARED_WORKSPACE_E2E_IMAGE)"
SKIP_BUILD="${QUIET_CORE_AGENTS_DELETE_SHARED_WORKSPACE_E2E_SKIP_BUILD:-0}"
DOCKER_COMMAND_TIMEOUT="${QUIET_CORE_AGENTS_DELETE_SHARED_WORKSPACE_DOCKER_COMMAND_TIMEOUT:-300s}"
QUIET_CORE_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 agents-delete-shared-workspace empty)"

docker_e2e_build_or_reuse "$IMAGE_NAME" agents-delete-shared-workspace "$ROOT_DIR/Dockerfile" "$ROOT_DIR" "" "$SKIP_BUILD"
docker_e2e_harness_mount_args

run_logged agents-delete-shared-workspace docker_e2e_docker_cmd run --rm \
  "${DOCKER_E2E_HARNESS_ARGS[@]}" \
  --entrypoint bash \
  -e QUIET_CORE_SKIP_CHANNELS=1 \
  -e QUIET_CORE_SKIP_PROVIDERS=1 \
  -e QUIET_CORE_SKIP_GMAIL_WATCHER=1 \
  -e QUIET_CORE_SKIP_CRON=1 \
  -e QUIET_CORE_SKIP_CANVAS_HOST=1 \
  -e QUIET_CORE_SKIP_BROWSER_CONTROL_SERVER=1 \
  -e QUIET_CORE_SKIP_ACPX_RUNTIME=1 \
  -e QUIET_CORE_SKIP_ACPX_RUNTIME_PROBE=1 \
  -e QUIET_CORE_GATEWAY_TOKEN=agents-delete-shared-workspace-token \
  -e "QUIET_CORE_TEST_STATE_SCRIPT_B64=$QUIET_CORE_TEST_STATE_SCRIPT_B64" \
  "$IMAGE_NAME" \
  -lc '
set -euo pipefail
source scripts/lib/quiet-core-bot-e2e-instance.sh

run_quiet-core-bot() {
  if command -v quiet-core-bot >/dev/null 2>&1; then
    quiet-core-bot "$@"
    return
  fi
  if [ -f /app/quiet-core-bot.mjs ]; then
    node /app/quiet-core-bot.mjs "$@"
    return
  fi
  echo "quiet-core-bot CLI not found in Docker image" >&2
  exit 1
}

quiet_core_bot_e2e_eval_test_state_from_b64 "${QUIET_CORE_TEST_STATE_SCRIPT_B64:?missing QUIET_CORE_TEST_STATE_SCRIPT_B64}"
export SHARED_WORKSPACE="$HOME/workspace-shared"
output_file="$HOME/delete.json"
trap '\''rm -rf "$HOME"'\'' EXIT

mkdir -p "$QUIET_CORE_STATE_DIR" "$SHARED_WORKSPACE"
node scripts/e2e/lib/fixture.mjs agents-delete-config

run_quiet-core-bot agents delete ops --force --json > "$output_file"

node scripts/e2e/lib/fixture.mjs agents-delete-assert "$output_file"
'
