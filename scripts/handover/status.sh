#!/usr/bin/env bash
# OpenClaw handover · show gateway status (Docker or Node mode).
#
# Usage: bash scripts/handover/status.sh [docker|node]

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/start.sh" status "$@"
