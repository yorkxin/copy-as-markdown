#!/usr/bin/env bash
set -euo pipefail

export FORCE_COLOR=1
export BROWSER="${BROWSER:-all}"
case "$BROWSER" in
  all) pytest_targets=(e2e_test/) ;;
  firefox) pytest_targets=(e2e_test/ --ignore=e2e_test/test_chrome_smoke.py) ;;
  cft) pytest_targets=(e2e_test/test_chrome_smoke.py) ;;
  *) echo "Unsupported Selenium browser: $BROWSER" >&2; exit 1 ;;
esac

mkdir -p test-results
{
  echo "Environment: Firefox $FIREFOX_VERSION + Chrome for Testing $CFT_VERSION; tests: $BROWSER; architecture: $(uname -m)"
  "$FIREFOX_BINARY" --version
  geckodriver --version
  cat /opt/firefox/archive.sha256
  "$CHROME_BINARY" --version
  "$CHROMEDRIVER_BINARY" --version
  cat /opt/cft/archive.sha256
} | tee test-results/browser.log

test "$("$FIREFOX_BINARY" --version)" = "Mozilla Firefox $FIREFOX_VERSION"
test "$("$CHROME_BINARY" --version | awk '{print $NF}')" = "$CFT_VERSION"
test "$("$CHROMEDRIVER_BINARY" --version | awk '{print $2}')" = "$CFT_VERSION"

echo "[docker] Building test extensions..."
npm run test:e2e:build

echo "[Test] One pytest session; browsers: $BROWSER (Xvfb)"

export GNOME_ACCESSIBILITY=1

set +e
dbus-run-session -- xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR" \
  python -m pytest "${pytest_targets[@]}" -v -r s --continue-on-collection-errors --junitxml=test-results/junit.xml "$@"

exit_code=$?
echo "[Test finished] Selenium session: exit $exit_code"
exit $exit_code
