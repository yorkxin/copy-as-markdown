#!/usr/bin/env bash
# Run the same entrypoint as CI, in disposable official browser containers.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
profile="${PROFILE:-latest}"
case "$profile:${BROWSER:-}" in
  latest:) browsers=(firefox chromium) ;;
  latest:firefox|latest:chromium) browsers=("$BROWSER") ;;
  esr:|esr:firefox) browsers=(firefox) ;;
  *) echo 'Use PROFILE=latest|esr and BROWSER=firefox|chromium (ESR requires Firefox).' >&2; exit 2 ;;
esac
for browser in "${browsers[@]}"; do
  results="$PWD/test-results/selenium-$profile-$browser"
  mkdir -p "$results"
  rm -f "$results"/{junit.xml,browser.log,environment.log,run.log,firefox-esr.sha256}
done
npm run test:e2e:build
snapshot="$(mktemp -d)"
trap 'rm -rf "$snapshot"' EXIT
COPYFILE_DISABLE=1 tar -cf "$snapshot/checkout.tar" requirements.txt docker/selenium-ci e2e_test fixtures firefox-test chrome-test
status=0
for browser in "${browsers[@]}"; do
  image="selenium/standalone-$browser:latest"
  results="$PWD/test-results/selenium-$profile-$browser"
  mkdir -p "$results"
  echo "=== $browser ($profile): $image ==="
  if docker run --rm --user root --ipc=host --entrypoint bash \
    -e BROWSER="$browser" -e PROFILE="$profile" -e FIREFOX_ESR_MAJOR="${FIREFOX_ESR_MAJOR:-140}" \
    -e SELENIUM_BASE_IMAGE="$image" \
    -v "$snapshot/checkout.tar:/checkout.tar:ro" \
    -v "$results:/workspace/test-results/selenium-$profile-$browser" \
    "$image" -c 'mkdir -p /workspace; tar -xf /checkout.tar -C /workspace; exec bash /workspace/docker/selenium-ci/run-official.sh "$@"' bash "$@"; then
    echo "=== $browser finished ==="
  else
    status=$?
    echo "=== $browser failed (exit $status) ===" >&2
    if [[ "$status" == 130 || "$status" == 143 ]]; then exit "$status"; fi
  fi
done
exit "$status"
