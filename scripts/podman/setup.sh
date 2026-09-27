#!/usr/bin/env bash
# One-time host setup for rootless OpenClaw in Podman. Uses the current
# non-root user throughout, builds or pulls the image into that user's Podman
# store, writes config under ~/.quiet-core-bot by default, and uses the repo-local
# launch script at ./scripts/run-quiet-core-bot-podman.sh.
#
# Usage: ./scripts/podman/setup.sh [--quadlet|--container]
#   --quadlet   Install a Podman Quadlet as the current user's systemd service
#   --container Only install image + config; you start the container manually (default)
#   Or set QUIET_CORE_PODMAN_QUADLET=1 (or 0) to choose without a flag.
#
# After this, start the gateway manually:
#   ./scripts/run-quiet-core-bot-podman.sh launch
#   ./scripts/run-quiet-core-bot-podman.sh launch setup
# Or, if you used --quadlet:
#   systemctl --user start quiet-core-bot.service
set -euo pipefail

REPO_PATH="${QUIET_CORE_REPO_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
source "$REPO_PATH/scripts/lib/host-timeout.sh"
RUN_SCRIPT_SRC="$REPO_PATH/scripts/run-quiet-core-bot-podman.sh"
QUADLET_TEMPLATE="$REPO_PATH/scripts/podman/quiet-core-bot.container.in"
QUIET_CORE_USER="$(id -un)"
QUIET_CORE_HOME="${HOME:-}"
QUIET_CORE_CONFIG_DIR="${QUIET_CORE_CONFIG_DIR:-}"
QUIET_CORE_WORKSPACE_DIR="${QUIET_CORE_WORKSPACE_DIR:-}"
QUIET_CORE_IMAGE="${QUIET_CORE_PODMAN_IMAGE:-${QUIET_CORE_IMAGE:-quiet-core-bot:local}}"
QUIET_CORE_CONTAINER_NAME="${QUIET_CORE_PODMAN_CONTAINER:-quiet-core-bot}"
PLATFORM_NAME="$(uname -s 2>/dev/null || echo unknown)"
HOST_GATEWAY_PORT="${QUIET_CORE_PODMAN_GATEWAY_HOST_PORT:-${QUIET_CORE_GATEWAY_PORT:-18789}}"
QUADLET_GATEWAY_PORT="18789"
PODMAN_PULL_TIMEOUT="${QUIET_CORE_PODMAN_SETUP_PULL_TIMEOUT:-600s}"
PODMAN_BUILD_TIMEOUT="${QUIET_CORE_PODMAN_SETUP_BUILD_TIMEOUT:-1800s}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

is_root() { [[ "$(id -u)" -eq 0 ]]; }

fail() {
  echo "$*" >&2
  exit 1
}

run_podman_pull() {
  local image="$1"
  quiet_core_bot_host_timeout_cmd "$PODMAN_PULL_TIMEOUT" podman pull "$image"
}

run_podman_build() {
  quiet_core_bot_host_timeout_cmd "$PODMAN_BUILD_TIMEOUT" podman build "$@"
}

validate_single_line_value() {
  local label="$1"
  local value="$2"
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    fail "Invalid $label: control characters are not allowed."
  fi
}

validate_absolute_path() {
  local label="$1"
  local value="$2"
  validate_single_line_value "$label" "$value"
  [[ "$value" == /* ]] || fail "Invalid $label: expected an absolute path."
  [[ "$value" != *"//"* ]] || fail "Invalid $label: repeated slashes are not allowed."
  [[ "$value" != *"/./"* && "$value" != */. && "$value" != *"/../"* && "$value" != */.. ]] ||
    fail "Invalid $label: dot path segments are not allowed."
}

validate_mount_source_path() {
  local label="$1"
  local value="$2"
  validate_absolute_path "$label" "$value"
  [[ "$value" != *:* ]] || fail "Invalid $label: ':' is not allowed in Podman bind-mount source paths."
}

validate_container_name() {
  local value="$1"
  validate_single_line_value "container name" "$value"
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] ||
    fail "Invalid container name: $value"
}

validate_image_name() {
  local value="$1"
  validate_single_line_value "image name" "$value"
  case "$value" in
    oci-archive:*|docker-archive:*|dir:*|oci:*|containers-storage:*|docker-daemon:*|archive:* )
      fail "Invalid image name: transport prefixes are not allowed: $value"
      ;;
  esac
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]] ||
    fail "Invalid image name: $value"
}

ensure_safe_existing_dir() {
  local label="$1"
  local dir="$2"
  validate_absolute_path "$label" "$dir"
  [[ -d "$dir" ]] || fail "Missing $label: $dir"
  [[ ! -L "$dir" ]] || fail "Unsafe $label: symlinks are not allowed ($dir)"
}

stat_uid() {
  local path="$1"
  if stat -f '%u' "$path" >/dev/null 2>&1; then
    stat -f '%u' "$path"
  else
    stat -Lc '%u' "$path"
  fi
}

stat_mode() {
  local path="$1"
  if stat -f '%Lp' "$path" >/dev/null 2>&1; then
    stat -f '%Lp' "$path"
  else
    stat -Lc '%a' "$path"
  fi
}

ensure_private_existing_dir_owned_by_user() {
  local label="$1"
  local dir="$2"
  local uid=""
  local mode=""
  ensure_safe_existing_dir "$label" "$dir"
  uid="$(stat_uid "$dir")"
  [[ "$uid" == "$(id -u)" ]] || fail "Unsafe $label: not owned by current user ($dir)"
  mode="$(stat_mode "$dir")"
  (( (8#$mode & 0022) == 0 )) || fail "Unsafe $label: group/other writable ($dir)"
}

ensure_safe_write_file_path() {
  local label="$1"
  local file="$2"
  local dir
  validate_absolute_path "$label" "$file"
  if [[ -e "$file" ]]; then
    [[ ! -L "$file" ]] || fail "Unsafe $label: symlinks are not allowed ($file)"
    [[ -f "$file" ]] || fail "Unsafe $label: expected a regular file ($file)"
  fi
  dir="$(dirname "$file")"
  ensure_safe_existing_dir "${label} parent directory" "$dir"
}

write_file_atomically() {
  local file="$1"
  local mode="$2"
  local dir=""
  local tmp=""
  ensure_safe_write_file_path "output file" "$file"
  dir="$(dirname "$file")"
  tmp="$(mktemp "$dir/.tmp.XXXXXX")"
  cat >"$tmp"
  chmod "$mode" "$tmp"
  mv -f "$tmp" "$file"
}

validate_port() {
  local label="$1"
  local value="$2"
  local numeric=""
  [[ "$value" =~ ^[0-9]{1,5}$ ]] || fail "Invalid $label: must be numeric."
  numeric=$((10#$value))
  (( numeric >= 1 && numeric <= 65535 )) || fail "Invalid $label: out of range."
}

escape_sed_replacement_pipe_delim() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

resolve_user_home() {
  local user="$1"
  local home=""
  if command -v getent >/dev/null 2>&1; then
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6 || true)"
  fi
  if [[ -z "$home" && -f /etc/passwd ]]; then
    home="$(awk -F: -v u="$user" '$1==u {print $6}' /etc/passwd 2>/dev/null || true)"
  fi
  if [[ -z "$home" ]]; then
    home="/home/$user"
  fi
  printf '%s' "$home"
}

generate_token_hex_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
    return 0
  fi
  if command -v od >/dev/null 2>&1; then
    od -An -N32 -tx1 /dev/urandom | tr -d " \n"
    return 0
  fi
  echo "Missing dependency: need openssl or python3 (or od) to generate QUIET_CORE_GATEWAY_TOKEN." >&2
  exit 1
}

seed_local_control_ui_origins() {
  local file="$1"
  local port="$2"
  local dir=""
  local tmp=""
  ensure_safe_write_file_path "config file" "$file"
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Warning: python3 not found; unable to seed gateway.controlUi.allowedOrigins in $file." >&2
    return 0
  fi
  dir="$(dirname "$file")"
  tmp="$(mktemp "$dir/.config.tmp.XXXXXX")"
  if ! python3 - "$file" "$port" "$tmp" <<'PY'
import json
import sys

path = sys.argv[1]
port = sys.argv[2]
tmp = sys.argv[3]
try:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
except json.JSONDecodeError as exc:
    print(
        f"Warning: unable to seed gateway.controlUi.allowedOrigins in {path}: existing config is not strict JSON ({exc}). Leaving file unchanged.",
        file=sys.stderr,
    )
    raise SystemExit(1)
if not isinstance(data, dict):
    raise SystemExit(f"{path}: expected top-level object")
gateway = data.setdefault("gateway", {})
if not isinstance(gateway, dict):
    raise SystemExit(f"{path}: expected gateway object")
gateway.setdefault("mode", "local")
control_ui = gateway.setdefault("controlUi", {})
if not isinstance(control_ui, dict):
    raise SystemExit(f"{path}: expected gateway.controlUi object")
allowed = control_ui.get("allowedOrigins")
managed_localhosts = {"127.0.0.1", "localhost"}
desired = [
    f"http://127.0.0.1:{port}",
    f"http://localhost:{port}",
]
if not isinstance(allowed, list):
    allowed = []
cleaned = []
for origin in allowed:
    if not isinstance(origin, str):
        continue
    normalized = origin.strip()
    if not normalized:
        continue
    if normalized.startswith("http://"):
        host_port = normalized[len("http://") :]
        host = host_port.split(":", 1)[0]
        if host in managed_localhosts:
            continue
    cleaned.append(normalized)
control_ui["allowedOrigins"] = cleaned + desired
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
PY
  then
    rm -f "$tmp"
    return 0
  fi
  [[ -s "$tmp" ]] || {
    rm -f "$tmp"
    return 0
  }
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$file"
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  local dir
  ensure_safe_write_file_path "env file" "$file"
  dir="$(dirname "$file")"
  tmp="$(mktemp "$dir/.env.tmp.XXXXXX")"
  if [[ -f "$file" ]]; then
    awk -v k="$key" -v v="$value" '
      BEGIN { found = 0 }
      $0 ~ ("^" k "=") { print k "=" v; found = 1; next }
      { print }
      END { if (!found) print k "=" v }
    ' "$file" >"$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >"$tmp"
  fi
  mv "$tmp" "$file"
  chmod 600 "$file" 2>/dev/null || true
}

INSTALL_QUADLET=false
for arg in "$@"; do
  case "$arg" in
    --quadlet) INSTALL_QUADLET=true ;;
    --container) INSTALL_QUADLET=false ;;
  esac
done
if [[ -n "${QUIET_CORE_PODMAN_QUADLET:-}" ]]; then
  case "${QUIET_CORE_PODMAN_QUADLET,,}" in
    1|yes|true) INSTALL_QUADLET=true ;;
    0|no|false) INSTALL_QUADLET=false ;;
  esac
fi
if [[ "$INSTALL_QUADLET" == true && "$PLATFORM_NAME" != "Linux" ]]; then
  fail "--quadlet is only supported on Linux with systemd user services."
fi

SEED_GATEWAY_PORT="$HOST_GATEWAY_PORT"
if [[ "$INSTALL_QUADLET" == true ]]; then
  SEED_GATEWAY_PORT="$QUADLET_GATEWAY_PORT"
fi

require_cmd podman
if is_root; then
  echo "Run scripts/podman/setup.sh as your normal user so Podman stays rootless." >&2
  exit 1
fi
if [[ "$QUIET_CORE_IMAGE" == "quiet-core-bot:local" ]] && [[ ! -f "$REPO_PATH/Dockerfile" ]]; then
  echo "Dockerfile not found at $REPO_PATH. Set QUIET_CORE_REPO_PATH to the repo root." >&2
  exit 1
fi
if [[ ! -f "$RUN_SCRIPT_SRC" ]]; then
  echo "Launch script not found at $RUN_SCRIPT_SRC." >&2
  exit 1
fi

if [[ -z "$QUIET_CORE_HOME" ]]; then
  QUIET_CORE_HOME="$(resolve_user_home "$QUIET_CORE_USER")"
fi
if [[ -z "$QUIET_CORE_HOME" ]]; then
  echo "Unable to resolve HOME for user $QUIET_CORE_USER." >&2
  exit 1
fi
if [[ -z "$QUIET_CORE_CONFIG_DIR" ]]; then
  QUIET_CORE_CONFIG_DIR="$QUIET_CORE_HOME/.quiet-core-bot"
fi
if [[ -z "$QUIET_CORE_WORKSPACE_DIR" ]]; then
  QUIET_CORE_WORKSPACE_DIR="$QUIET_CORE_CONFIG_DIR/workspace"
fi
validate_absolute_path "home directory" "$QUIET_CORE_HOME"
validate_mount_source_path "config directory" "$QUIET_CORE_CONFIG_DIR"
validate_mount_source_path "workspace directory" "$QUIET_CORE_WORKSPACE_DIR"
validate_container_name "$QUIET_CORE_CONTAINER_NAME"
validate_image_name "$QUIET_CORE_IMAGE"
validate_port "gateway host port" "$HOST_GATEWAY_PORT"
validate_port "seed gateway port" "$SEED_GATEWAY_PORT"

install -d -m 700 "$QUIET_CORE_CONFIG_DIR" "$QUIET_CORE_WORKSPACE_DIR"
ensure_private_existing_dir_owned_by_user "config directory" "$QUIET_CORE_CONFIG_DIR"
ensure_private_existing_dir_owned_by_user "workspace directory" "$QUIET_CORE_WORKSPACE_DIR"

QUIET_CORE_IMAGE_APT_PACKAGES="${QUIET_CORE_IMAGE_APT_PACKAGES-${QUIET_CORE_DOCKER_APT_PACKAGES:-}}"
QUIET_CORE_IMAGE_PIP_PACKAGES="${QUIET_CORE_IMAGE_PIP_PACKAGES:-}"
BUILD_ARGS=()
if [[ -n "$QUIET_CORE_IMAGE_APT_PACKAGES" ]]; then
  BUILD_ARGS+=(--build-arg "QUIET_CORE_IMAGE_APT_PACKAGES=${QUIET_CORE_IMAGE_APT_PACKAGES}")
fi
if [[ -n "$QUIET_CORE_IMAGE_PIP_PACKAGES" ]]; then
  BUILD_ARGS+=(--build-arg "QUIET_CORE_IMAGE_PIP_PACKAGES=${QUIET_CORE_IMAGE_PIP_PACKAGES}")
fi
if [[ -n "${QUIET_CORE_EXTENSIONS:-}" ]]; then
  BUILD_ARGS+=(--build-arg "QUIET_CORE_EXTENSIONS=${QUIET_CORE_EXTENSIONS}")
fi
if [[ -n "${QUIET_CORE_INSTALL_BROWSER:-}" ]]; then
  BUILD_ARGS+=(--build-arg "QUIET_CORE_INSTALL_BROWSER=${QUIET_CORE_INSTALL_BROWSER}")
fi

if [[ "$QUIET_CORE_IMAGE" == "quiet-core-bot:local" ]]; then
  echo "Building image $QUIET_CORE_IMAGE ..."
  run_podman_build -t "$QUIET_CORE_IMAGE" -f "$REPO_PATH/Dockerfile" "${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"}" "$REPO_PATH"
else
  if podman image exists "$QUIET_CORE_IMAGE" >/dev/null 2>&1; then
    echo "Using existing image $QUIET_CORE_IMAGE"
  else
    echo "Pulling image $QUIET_CORE_IMAGE ..."
    run_podman_pull "$QUIET_CORE_IMAGE"
  fi
fi

ENV_FILE="$QUIET_CORE_CONFIG_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  TOKEN="$(generate_token_hex_32)"
  (
    umask 077
    write_file_atomically "$ENV_FILE" 600 <<EOF
QUIET_CORE_GATEWAY_TOKEN=$TOKEN
EOF
  )
  echo "Generated QUIET_CORE_GATEWAY_TOKEN and wrote it to $ENV_FILE"
fi
upsert_env_var "$ENV_FILE" "QUIET_CORE_PODMAN_CONTAINER" "$QUIET_CORE_CONTAINER_NAME"
upsert_env_var "$ENV_FILE" "QUIET_CORE_PODMAN_IMAGE" "$QUIET_CORE_IMAGE"

CONFIG_JSON="$QUIET_CORE_CONFIG_DIR/quiet-core-bot.json"
if [[ ! -f "$CONFIG_JSON" ]]; then
  (
    umask 077
    write_file_atomically "$CONFIG_JSON" 600 <<JSON
{
  "gateway": {
    "mode": "local",
        "controlUi": {
          "allowedOrigins": [
        "http://127.0.0.1:${SEED_GATEWAY_PORT}",
        "http://localhost:${SEED_GATEWAY_PORT}"
      ]
    }
  }
}
JSON
  )
  echo "Wrote minimal config to $CONFIG_JSON"
fi
seed_local_control_ui_origins "$CONFIG_JSON" "$SEED_GATEWAY_PORT"

if [[ "$INSTALL_QUADLET" == true ]]; then
  QUADLET_DIR="$QUIET_CORE_HOME/.config/containers/systemd"
  QUADLET_DST="$QUADLET_DIR/quiet-core-bot.container"
  echo "Installing Quadlet to $QUADLET_DST ..."
  mkdir -p "$QUADLET_DIR"
  ensure_safe_existing_dir "quadlet directory" "$QUADLET_DIR"
  QUIET_CORE_HOME_ESCAPED="$(escape_sed_replacement_pipe_delim "$QUIET_CORE_HOME")"
  QUIET_CORE_CONFIG_ESCAPED="$(escape_sed_replacement_pipe_delim "$QUIET_CORE_CONFIG_DIR")"
  QUIET_CORE_WORKSPACE_ESCAPED="$(escape_sed_replacement_pipe_delim "$QUIET_CORE_WORKSPACE_DIR")"
  QUIET_CORE_IMAGE_ESCAPED="$(escape_sed_replacement_pipe_delim "$QUIET_CORE_IMAGE")"
  QUIET_CORE_CONTAINER_ESCAPED="$(escape_sed_replacement_pipe_delim "$QUIET_CORE_CONTAINER_NAME")"
  sed \
    -e "s|{{QUIET_CORE_HOME}}|$QUIET_CORE_HOME_ESCAPED|g" \
    -e "s|{{QUIET_CORE_CONFIG_DIR}}|$QUIET_CORE_CONFIG_ESCAPED|g" \
    -e "s|{{QUIET_CORE_WORKSPACE_DIR}}|$QUIET_CORE_WORKSPACE_ESCAPED|g" \
    -e "s|{{IMAGE_NAME}}|$QUIET_CORE_IMAGE_ESCAPED|g" \
    -e "s|{{CONTAINER_NAME}}|$QUIET_CORE_CONTAINER_ESCAPED|g" \
    "$QUADLET_TEMPLATE" | write_file_atomically "$QUADLET_DST" 644

  if command -v systemctl >/dev/null 2>&1; then
    echo "Reloading and starting user service..."
    if systemctl --user daemon-reload && systemctl --user start quiet-core-bot.service; then
      echo "Quadlet installed and service started."
    else
      echo "Quadlet installed, but automatic start failed." >&2
      echo "Try: systemctl --user daemon-reload && systemctl --user start quiet-core-bot.service" >&2
      if command -v loginctl >/dev/null 2>&1; then
        echo "For boot persistence on headless hosts, you may also need: sudo loginctl enable-linger $(whoami)" >&2
      fi
    fi
  else
    echo "systemctl not found; Quadlet installed but not started." >&2
  fi
else
  echo "Container setup complete."
fi

echo
echo "Next:"
echo "  ./scripts/run-quiet-core-bot-podman.sh launch"
echo "  ./scripts/run-quiet-core-bot-podman.sh launch setup"
echo "  quiet-core-bot --container $QUIET_CORE_CONTAINER_NAME dashboard --no-open"
