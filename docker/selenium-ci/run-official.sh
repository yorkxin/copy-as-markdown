#!/usr/bin/env bash
# CI entrypoint inside the official Selenium image; extensions are built upstream.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
export PROFILE="${PROFILE:-latest}" BROWSER="${BROWSER:-firefox}"
case "$PROFILE:$BROWSER" in
  latest:firefox|esr:firefox|latest:chromium) ;;
  *) echo "Unsupported official-image selection: $PROFILE/$BROWSER" >&2; exit 1 ;;
esac
results="$PWD/test-results/selenium-$PROFILE-$BROWSER"
mkdir -p "$results"
chmod 1777 "$results"
rm -f "$results"/{junit.xml,browser.log,environment.log,run.log,firefox-esr.sha256}
exec > >(tee "$results/run.log") 2>&1
export DEBIAN_FRONTEND=noninteractive
# Chromium's image installs sid packages, then removes the Debian source.
# Restore it so APT can supply GI bindings matching the installed GLib.
source /etc/os-release
apt_options=()
if [[ "$ID" == debian ]]; then
  printf 'deb http://deb.debian.org/debian sid main\n' > /etc/apt/sources.list.d/debian.list
  python_bin=/usr/bin/python3
  venv_package=python3-venv
  apt_options=(-t sid)
else
  python_bin=/usr/bin/python3.12
  venv_package=python3.12-venv
fi
apt-get update
if [[ "$ID" == debian ]]; then
  # The image's Ubuntu PPA Python overlaps Debian's split minimal packages.
  python_package="$(basename "$(readlink -f /usr/bin/python3)")"
  if [[ "$(dpkg-query -W -f='${Version}' "$python_package")" == *noble* ]]; then
    apt-get remove -y "$python_package" "$python_package-venv" "lib$python_package-stdlib"
  fi
fi
apt-get install -y --no-install-recommends "${apt_options[@]}" xsel xdotool at-spi2-core dbus xz-utils \
  python3-gi gir1.2-atspi-2.0 "$venv_package"
# Use the distro's GI-compatible Python, rather than the pre-existing image venv.
"$python_bin" -m venv --system-site-packages /tmp/selenium-test-venv
sed '/^PyGObject$/d' requirements.txt > /tmp/selenium-test-requirements.txt
/tmp/selenium-test-venv/bin/pip install --no-cache-dir -r /tmp/selenium-test-requirements.txt
if [[ "$BROWSER" == chromium ]]; then
  export CHROME_BINARY="$(command -v chromium)"
  export CHROMEDRIVER_BINARY="$(command -v chromedriver)"
  export CHROMIUM_VERSION="$("$CHROME_BINARY" --version | awk '{print $2}')"
  pytest_targets=(e2e_test/test_chrome_smoke.py)
  test -f chrome-test/manifest.json
  "$CHROMEDRIVER_BINARY" --version
else
  if [[ "$PROFILE" == esr ]]; then
    resolved=$(/tmp/selenium-test-venv/bin/python docker/selenium-ci/resolve_firefox.py "esr:${FIREFOX_ESR_MAJOR:?Set FIREFOX_ESR_MAJOR in CI}")
    version=$(/tmp/selenium-test-venv/bin/python -c 'import json,sys; print(json.load(sys.stdin)["version"])' <<< "$resolved")
    release="$(apt-cache madison firefox-esr | awk -v version="$version" 'index($3, version "~") == 1 {print $3; exit}')"
    if [[ -n "$release" ]] && apt-get install -y --no-install-recommends "firefox-esr=$release"; then
      export FIREFOX_BINARY="$(command -v firefox-esr)"
      echo "[ESR] $version installed via APT"
    else
      echo "[ESR] APT cannot install $version; downloading Mozilla archive"
      case "$(dpkg --print-architecture)" in
        amd64) archive_arch=linux-x86_64 ;;
        arm64) archive_arch=linux-aarch64 ;;
        *) echo 'Unsupported Firefox archive architecture' >&2; exit 1 ;;
      esac
      archive="$archive_arch/en-US/firefox-$version.tar.xz"
      url="https://archive.mozilla.org/pub/firefox/releases/$version"
      curl -fsSL --retry 3 "$url/$archive" -o /tmp/firefox-esr.tar.xz
      curl -fsSL --retry 3 "$url/SHA256SUMS" -o /tmp/firefox-esr-SHA256SUMS
      awk -v archive="$archive" '$2 == archive {print $1 "  /tmp/firefox-esr.tar.xz"}' \
        /tmp/firefox-esr-SHA256SUMS > "$results/firefox-esr.sha256"
      test "$(wc -l < "$results/firefox-esr.sha256")" -eq 1
      sha256sum -c "$results/firefox-esr.sha256"
      mkdir -p /opt/firefox-esr
      tar -xJf /tmp/firefox-esr.tar.xz --strip-components=1 -C /opt/firefox-esr
      export FIREFOX_BINARY=/opt/firefox-esr/firefox
    fi
    test "$("$FIREFOX_BINARY" --version)" = "Mozilla Firefox $version"
  else
    export FIREFOX_BINARY="$(command -v firefox)"
  fi
  export FIREFOX_VERSION="$("$FIREFOX_BINARY" --version | awk '{print $NF}')"
  pytest_targets=(e2e_test/ --ignore=e2e_test/test_chrome_smoke.py)
  test -f firefox-test/manifest.json
  geckodriver --version
fi
{
  echo "Image: ${SELENIUM_BASE_IMAGE:-official Selenium}; profile: $PROFILE; browser: $BROWSER; architecture: $(uname -m)"
  if [[ "$BROWSER" == chromium ]]; then "$CHROME_BINARY" --version; else "$FIREFOX_BINARY" --version; fi
  /tmp/selenium-test-venv/bin/python --version
} | tee "$results/environment.log"
export CI=true GNOME_ACCESSIBILITY=1
# Keep tests and browser in the same X11/D-Bus session for native input and clipboard.
# Let runuser reset HOME: GitHub's /github/home is not writable by seluser.
runuser -u seluser -- dbus-run-session -- xvfb-run -a \
  --server-args='-screen 0 1280x720x24 -ac +extension RANDR' \
  /tmp/selenium-test-venv/bin/python -m pytest "${pytest_targets[@]}" -v -r s \
  --continue-on-collection-errors -o "cache_dir=$results/.pytest_cache" --junitxml="$results/junit.xml" "$@"
