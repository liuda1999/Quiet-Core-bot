#!/usr/bin/env bash
# OpenClaw handover · restart the gateway (Docker or Node mode).
#
# Usage: bash scripts/handover/restart.sh [docker|node]

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/start.sh" restart "$@"
