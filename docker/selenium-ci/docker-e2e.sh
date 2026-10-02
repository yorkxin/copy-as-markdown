#!/usr/bin/env bash
#
# Host-side orchestrator for the Dockerized Selenium browser e2e suites.
#
# Builds the image and runs the suite, then removes the image build that this run
# superseded. Rebuilding a version-specific Docker tag
# orphans the previously-tagged image as a dangling <none> image; left unchecked
# these pile up. Pruning is scoped by our own LABEL so other projects' dangling
# images on the machine are never touched.
#
# Any extra arguments are forwarded to pytest by the container entrypoint.
set -euo pipefail

SELENIUM_BROWSER="${SELENIUM_BROWSER:-firefox}"
case "$SELENIUM_BROWSER" in
  firefox|cft) ;;
  *) echo "Unsupported Selenium browser: $SELENIUM_BROWSER" >&2; exit 1 ;;
esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL=com.copy-as-markdown.image=selenium-e2e
platform="${DOCKER_DEFAULT_PLATFORM:-linux/$(docker version --format '{{.Server.Arch}}')}"
build_args=(--platform "$platform" --build-arg "SELENIUM_BROWSER=$SELENIUM_BROWSER")
metadata=""
case "$SELENIUM_BROWSER" in
  firefox)
    requested="${FIREFOX_VERSION:-139.0}"
    browser_name=Firefox
    metadata="$(python3 "$ROOT/docker/selenium-ci/resolve_firefox.py" "$requested" "$platform")"
    version="$(python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])' <<< "$metadata")"
    build_args+=(--build-arg "FIREFOX_VERSION=$version")
    ;;
  cft)
    requested="${CFT_VERSION:-116.0.5845.96}"
    browser_name="Chrome for Testing"
    case "$platform" in
      linux/amd64) cft_platform=linux64 ;;
      linux/arm64|linux/arm64/v8) cft_platform=linux-arm64 ;;
      *) echo "Unsupported CfT Docker platform: $platform" >&2; exit 1 ;;
    esac
    metadata="$(python3 "$ROOT/docker/selenium-ci/resolve_cft.py" "$requested" "$cft_platform")"
    read -r version chrome_url driver_url <<< "$(python3 -c 'import json, sys; d=json.load(sys.stdin); print(d["version"], d["chrome_url"], d["chromedriver_url"])' <<< "$metadata")"
    build_args+=(--build-arg "CFT_VERSION=$version" --build-arg "CFT_CHROME_URL=$chrome_url" --build-arg "CFT_DRIVER_URL=$driver_url")
    ;;
esac
IMAGE="copy-as-markdown-selenium:$SELENIUM_BROWSER-$version"

RESULTS="$ROOT/test-results/selenium-$SELENIUM_BROWSER-$version"
mkdir -p "$RESULTS"
# Linux runners need not share appuser's UID 1000. This directory contains only
# generated reports; sticky permissions let the container write without running
# it as root and keep other users from deleting one another's output files.
chmod 1777 "$RESULTS"
# A build/startup failure must not upload a previous run's successful JUnit.
rm -f "$RESULTS/junit.xml" "$RESULTS/browser.log" "$RESULTS/run.log" "$RESULTS/metadata.json"
if [[ -n "$metadata" ]]; then
  printf '%s\n' "$metadata" > "$RESULTS/metadata.json"
fi
echo "[Resolve] $browser_name: requested $requested -> $version; platform $platform" | tee "$RESULTS/environment.log"
set +e
docker build "${build_args[@]}" -t "$IMAGE" \
  -f "$ROOT/docker/selenium-ci/Dockerfile" "$ROOT" 2>&1 | tee "$RESULTS/build.log"
code=${PIPESTATUS[0]}
set -e
if [[ "$code" -ne 0 ]]; then
  echo "[Result] $browser_name $version: FAILED (build exit $code)"
  exit "$code"
fi

docker image inspect --format 'Image: {{.Id}}; architecture: {{.Architecture}}' "$IMAGE" |
  tee -a "$RESULTS/environment.log"
set +e
docker run --rm --platform "$platform" --ipc=host -e CI=true -e "SELENIUM_BROWSER=$SELENIUM_BROWSER" \
  -v "$RESULTS:/workspace/test-results" \
  "$IMAGE" "$@" 2>&1 | tee "$RESULTS/run.log"
code=${PIPESTATUS[0]}

# Remove dangling images orphaned by this project's previous builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

if [[ "$code" -eq 0 ]]; then
  echo "[Result] $browser_name $version: PASSED (exit 0)"
else
  echo "[Result] $browser_name $version: FAILED (exit $code)"
  if [[ "$code" -eq 5 ]]; then
    echo "No tests matched for $browser_name; select SELENIUM_BROWSER=firefox or cft when using a subset." >&2
  fi
fi
exit "$code"
