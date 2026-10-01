#!/usr/bin/env bash
# QuietCore handover · stop the gateway (Docker or Node mode).
# Thin wrapper around scripts/handover/start.sh so every documented command works
# standalone. See start.sh for mode handling.
#
# Usage: bash scripts/handover/stop.sh [docker|node]

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/start.sh" stop "$@"
