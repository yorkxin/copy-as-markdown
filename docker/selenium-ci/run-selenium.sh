#!/usr/bin/env bash
set -euo pipefail

export FORCE_COLOR=1

echo "[docker] Building test extensions..."
npm run test:e2e:build

echo "[docker] Starting Selenium Firefox suite via Xvfb..."

xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" \
  python -m pytest e2e_test/ -v

exit_code=$?
echo "[docker] Selenium suite finished with exit code: $exit_code"
exit $exit_code
