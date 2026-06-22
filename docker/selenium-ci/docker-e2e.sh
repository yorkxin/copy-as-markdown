#!/usr/bin/env bash
#
# Host-side orchestrator for the Dockerized Selenium Firefox e2e suite.
#
# Builds the image and runs the suite, then removes the image build that this run
# superseded. Re-tagging on every `docker build -t copy-as-markdown-selenium`
# orphans the previously-tagged image as a dangling <none> image; left unchecked
# these pile up. Pruning is scoped by our own LABEL so other projects' dangling
# images on the machine are never touched.
#
# Any extra arguments are forwarded to `docker run` (after the image name).
set -uo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "error: test:e2e:selenium:docker is Linux-only (uses xdotool + AT-SPI)" >&2
    exit 1
fi

IMAGE=copy-as-markdown-selenium
LABEL=com.copy-as-markdown.image=selenium-e2e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

docker build -t "$IMAGE" -f "$ROOT/docker/selenium-ci/Dockerfile" "$ROOT" || exit $?

docker run --rm --ipc=host -e CI=true \
  -v "$ROOT/test-results:/workspace/test-results" \
  "$IMAGE" "$@"
code=$?

# Remove dangling images orphaned by this project's previous builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

exit "$code"
