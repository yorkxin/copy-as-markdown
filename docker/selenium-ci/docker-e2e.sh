#!/usr/bin/env bash
# One browser environment, one pytest session; Python preserves Docker statuses.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$ROOT/docker/selenium-ci/docker_e2e.py" "$@"
