#!/usr/bin/env bash
#
# Host-side orchestrator for the Dockerized Playwright e2e suite.
#
# Builds the image and runs the suite, then removes the image build that this run
# superseded. Re-tagging on every `docker build -t copy-as-markdown-playwright`
# orphans the previously-tagged image as a dangling <none> image; left unchecked
# these pile up at ~3 GB each. Pruning is scoped by our own LABEL (set in the
# Dockerfile) so other projects' dangling images on the machine are never touched.
#
# Any extra arguments are forwarded to `docker run` (after the image name), e.g. to
# override the entrypoint for a one-off `--retries=0` run.
set -uo pipefail

IMAGE=copy-as-markdown-playwright
LABEL=com.copy-as-markdown.image=playwright-e2e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

docker build -t "$IMAGE" -f "$ROOT/docker/playwright-ci/Dockerfile" "$ROOT" || exit $?

docker run --rm --ipc=host -e CI=true \
  -v "$ROOT/test-results:/workspace/test-results" \
  -v "$ROOT/playwright-report:/workspace/playwright-report" \
  "$IMAGE" "$@"
code=$?

# Remove dangling images orphaned by this project's previous builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

exit "$code"
