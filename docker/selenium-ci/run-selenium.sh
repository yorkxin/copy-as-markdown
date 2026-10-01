#!/usr/bin/env bash
set -euo pipefail

export FORCE_COLOR=1
export SELENIUM_BROWSER="${SELENIUM_BROWSER:-firefox}"
case "$SELENIUM_BROWSER" in
  firefox) pytest_targets=(e2e_test/ --ignore=e2e_test/test_chrome_smoke.py) ;;
  cft) pytest_targets=(e2e_test/test_chrome_smoke.py) ;;
  *) echo "Unsupported Selenium browser: $SELENIUM_BROWSER" >&2; exit 1 ;;
esac

mkdir -p test-results
{
  echo "Requested Firefox: $FIREFOX_VERSION; architecture: $(uname -m)"
  "$FIREFOX_BINARY" --version
  geckodriver --version
  cat /opt/firefox/archive.sha256
} | tee test-results/browser.log

echo "[docker] Building test extensions..."
npm run test:e2e:build

echo "[docker] Starting Selenium $SELENIUM_BROWSER suite via Xvfb..."

export GNOME_ACCESSIBILITY=1

set +e
dbus-run-session -- xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" \
  python -m pytest "${pytest_targets[@]}" -v -r s --junitxml=test-results/junit.xml "$@"

exit_code=$?
echo "[docker] Selenium suite finished with exit code: $exit_code"
exit $exit_code
