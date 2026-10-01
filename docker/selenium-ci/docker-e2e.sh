#!/usr/bin/env bash
#
# Host-side orchestrator for the Dockerized Selenium Firefox e2e suite.
#
# Builds the image and runs the suite, then removes the image build that this run
# superseded. Rebuilding a version-specific Docker tag
# orphans the previously-tagged image as a dangling <none> image; left unchecked
# these pile up. Pruning is scoped by our own LABEL so other projects' dangling
# images on the machine are never touched.
#
# Any extra arguments are forwarded to pytest by the container entrypoint.
set -euo pipefail

FIREFOX_VERSION="${FIREFOX_VERSION:-139.0}"
if [[ "$FIREFOX_VERSION" == latest ]]; then
  FIREFOX_VERSION="$(curl -fsSL --retry 3 https://product-details.mozilla.org/1.0/firefox_versions.json |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["LATEST_FIREFOX_VERSION"])')"
fi
if [[ ! "$FIREFOX_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Expected an exact stable Firefox version, got: $FIREFOX_VERSION" >&2
  exit 1
fi
IMAGE="copy-as-markdown-selenium:firefox-$FIREFOX_VERSION"
LABEL=com.copy-as-markdown.image=selenium-e2e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

RESULTS="$ROOT/test-results/selenium-firefox-$FIREFOX_VERSION"
mkdir -p "$RESULTS"
echo "Firefox requested version: $FIREFOX_VERSION" | tee "$RESULTS/environment.log"
set +e
docker build --build-arg "FIREFOX_VERSION=$FIREFOX_VERSION" -t "$IMAGE" \
  -f "$ROOT/docker/selenium-ci/Dockerfile" "$ROOT" 2>&1 | tee "$RESULTS/build.log"
code=${PIPESTATUS[0]}
set -e
if [[ "$code" -ne 0 ]]; then
  exit "$code"
fi

docker image inspect --format 'Image: {{.Id}}; architecture: {{.Architecture}}' "$IMAGE" |
  tee -a "$RESULTS/environment.log"
set +e
docker run --rm --ipc=host -e CI=true \
  -v "$RESULTS:/workspace/test-results" \
  "$IMAGE" "$@" 2>&1 | tee "$RESULTS/run.log"
code=${PIPESTATUS[0]}

# Remove dangling images orphaned by this project's previous builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

exit "$code"
