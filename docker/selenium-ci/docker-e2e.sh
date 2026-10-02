#!/usr/bin/env bash
# Host-side Docker orchestration. Each browser owns its image and reports;
# the default all run keeps suites serial and retains every failure status.
set -euo pipefail

selector="${SELENIUM_BROWSER:-all}"
case "$selector" in
  all) browsers=(firefox cft) ;;
  firefox|cft) browsers=("$selector") ;;
  *) echo "Unsupported Selenium browser: $selector" >&2; exit 1 ;;
esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL=com.copy-as-markdown.image=selenium-e2e
platform="${DOCKER_DEFAULT_PLATFORM:-linux/$(docker version --format '{{.Server.Arch}}')}"
trap 'echo "Interrupted; no further suites will be started." >&2; exit 130' INT
trap 'echo "Terminated; no further suites will be started." >&2; exit 143' TERM

# Called in an if condition: every fallible setup command explicitly returns its
# status, rather than relying on Bash errexit (disabled inside such functions).
run_browser() {
  local browser="$1"
  shift
  local metadata fields image results code
  local build_args=(--platform "$platform" --build-arg "SELENIUM_BROWSER=$browser")
  case "$browser" in
    firefox)
      browser_name=Firefox
      requested="${FIREFOX_VERSION:-latest}"
      metadata="$(python3 "$ROOT/docker/selenium-ci/resolve_firefox.py" "$requested" "$platform")" || return $?
      version="$(python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])' <<< "$metadata")" || return $?
      build_args+=(--build-arg "FIREFOX_VERSION=$version")
      ;;
    cft)
      browser_name="Chrome for Testing"
      requested="${CFT_VERSION:-latest}"
      local cft_platform chrome_url driver_url
      case "$platform" in
        linux/amd64) cft_platform=linux64 ;;
        linux/arm64|linux/arm64/v8) cft_platform=linux-arm64 ;;
        *) echo "Unsupported CfT Docker platform: $platform" >&2; return 1 ;;
      esac
      metadata="$(python3 "$ROOT/docker/selenium-ci/resolve_cft.py" "$requested" "$cft_platform")" || return $?
      fields="$(python3 -c 'import json, sys; d=json.load(sys.stdin); print(d["version"], d["chrome_url"], d["chromedriver_url"])' <<< "$metadata")" || return $?
      read -r version chrome_url driver_url <<< "$fields" || return $?
      build_args+=(--build-arg "CFT_VERSION=$version" --build-arg "CFT_CHROME_URL=$chrome_url" --build-arg "CFT_DRIVER_URL=$driver_url")
      ;;
  esac
  image="copy-as-markdown-selenium:$browser-$version"
  results="$ROOT/test-results/selenium-$browser-$version"
  mkdir -p "$results" || return $?
  # Report-only directory: Linux runner UID may differ from container UID 1000.
  chmod 1777 "$results" || return $?
  # A setup failure must never upload an earlier successful test report.
  rm -f "$results/junit.xml" "$results/browser.log" "$results/run.log" "$results/metadata.json" || return $?
  printf '%s\n' "$metadata" > "$results/metadata.json" || return $?
  echo "[Resolve] $browser_name: requested $requested -> $version; platform $platform" | tee "$results/environment.log" || return $?

  docker build "${build_args[@]}" -t "$image" \
    -f "$ROOT/docker/selenium-ci/Dockerfile" "$ROOT" 2>&1 | tee "$results/build.log"
  local statuses=("${PIPESTATUS[@]}")
  if [[ "${statuses[0]}" -ne 0 ]]; then return "${statuses[0]}"; fi
  if [[ "${statuses[1]}" -ne 0 ]]; then return "${statuses[1]}"; fi
  docker image inspect --format 'Image: {{.Id}}; architecture: {{.Architecture}}' "$image" |
    tee -a "$results/environment.log" || return $?

  docker run --rm --platform "$platform" --ipc=host -e CI=true -e "SELENIUM_BROWSER=$browser" \
    -v "$results:/workspace/test-results" "$image" "$@" 2>&1 | tee "$results/run.log"
  statuses=("${PIPESTATUS[@]}")
  code="${statuses[0]}"
  if [[ "$code" -eq 0 ]]; then code="${statuses[1]}"; fi
  # Scope pruning to images orphaned by this project's rebuilds.
  docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true
  if [[ "$code" -eq 5 ]]; then
    echo "No tests matched for $browser_name; select SELENIUM_BROWSER=firefox or cft when using a subset." >&2
  fi
  return "$code"
}

overall_code=0
summaries=()
for browser in "${browsers[@]}"; do
  version=""
  if run_browser "$browser" "$@"; then code=0; else code=$?; fi
  if [[ "$code" -eq 0 ]]; then status=PASSED; else status=FAILED; fi
  identity="$browser_name ${version:-requested $requested (unresolved)}"
  summary="$identity: $status (exit $code)"
  echo "[Result] $summary"
  summaries+=("$summary")
  if [[ "$overall_code" -eq 0 && "$code" -ne 0 ]]; then overall_code="$code"; fi
  # Exit 2 can also mean pytest collection failure; only explicit signal statuses
  # stop scheduling. Host SIGINT/SIGTERM are handled by the traps above.
  if [[ "$code" -eq 130 || "$code" -eq 143 ]]; then
    overall_code="$code"
    break
  fi
done
printf '\n[Selenium summary]\n'
printf '  %s\n' "${summaries[@]}"
exit "$overall_code"
