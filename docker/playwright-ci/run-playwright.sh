#!/usr/bin/env bash
set -euo pipefail

# Ensure npm output is flushed immediately
export FORCE_COLOR=1
export PWTEST_BYPASS_SNAPSHOT_WARNING=1
export NPM_CONFIG_LOGLEVEL=info

echo "[docker] Starting Playwright suite via Xvfb..."

# Use xvfb-run without exec to ensure proper process handling
# The -a flag auto-selects a display number
# --server-args configure the virtual framebuffer
xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" npm run test:e2e

# Capture the exit code
exit_code=$?
echo "[docker] Playwright suite finished with exit code: $exit_code"
exit $exit_code
