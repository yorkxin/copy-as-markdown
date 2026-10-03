#!/usr/bin/env bash
set -euo pipefail

case "$TARGETARCH" in
  amd64) ff_arch=linux-x86_64; gd_arch=linux64 ;;
  arm64) ff_arch=linux-aarch64; gd_arch=linux-aarch64 ;;
  *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;;
esac

case "$SELENIUM_BROWSER" in
  firefox)
    release="https://archive.mozilla.org/pub/firefox/releases/$FIREFOX_VERSION"
    archive="$ff_arch/en-US/firefox-$FIREFOX_VERSION.tar.xz"
    curl -fsSL --retry 3 "$release/$archive" -o /tmp/firefox.tar.xz
    curl -fsSL --retry 3 "$release/SHA256SUMS" -o /tmp/SHA256SUMS
    awk -v archive="$archive" '$2 == archive {print $1 "  /tmp/firefox.tar.xz"}' \
      /tmp/SHA256SUMS > /tmp/firefox.sha256
    test "$(wc -l < /tmp/firefox.sha256)" -eq 1
    sha256sum -c /tmp/firefox.sha256
    tar -xJf /tmp/firefox.tar.xz -C /opt
    ln -s "$FIREFOX_BINARY" /usr/local/bin/firefox
    test "$(firefox --version)" = "Mozilla Firefox $FIREFOX_VERSION"
    cp /tmp/firefox.sha256 /opt/firefox/archive.sha256
    curl -fsSL --retry 3 \
      "https://github.com/mozilla/geckodriver/releases/download/v$GECKODRIVER_VERSION/geckodriver-v$GECKODRIVER_VERSION-$gd_arch.tar.gz" \
      | tar xz -C /usr/local/bin
    chmod +x /usr/local/bin/geckodriver
    rm /tmp/firefox.tar.xz /tmp/SHA256SUMS /tmp/firefox.sha256
    ;;
  cft)
    case "$TARGETARCH" in
      amd64) cft_platform=linux64 ;;
      arm64) cft_platform=linux-arm64 ;;
    esac
    python /usr/local/bin/resolve_cft.py "$CFT_VERSION" "$cft_platform" > /tmp/cft-release.json
    CFT_CHROME_URL="$(python -c 'import json; print(json.load(open("/tmp/cft-release.json"))["chrome_url"])')"
    CFT_DRIVER_URL="$(python -c 'import json; print(json.load(open("/tmp/cft-release.json"))["chromedriver_url"])')"
    curl -fsSL --retry 3 "$CFT_CHROME_URL" -o /tmp/chrome.zip
    curl -fsSL --retry 3 "$CFT_DRIVER_URL" -o /tmp/chromedriver.zip
    mkdir -p /opt/cft
    # CfT metadata does not publish archive checksums; record downloaded hashes.
    sha256sum /tmp/chrome.zip /tmp/chromedriver.zip > /opt/cft/archive.sha256
    unzip -q /tmp/chrome.zip -d /opt/cft
    unzip -q /tmp/chromedriver.zip -d /tmp/cft-driver
    mv "/opt/cft/chrome-$cft_platform" /opt/cft/chrome
    mv "/tmp/cft-driver/chromedriver-$cft_platform/chromedriver" "$CHROMEDRIVER_BINARY"
    chmod +x "$CHROME_BINARY" "$CHROMEDRIVER_BINARY"
    test "$("$CHROME_BINARY" --version | awk '{print $NF}')" = "$CFT_VERSION"
    test "$("$CHROMEDRIVER_BINARY" --version | awk '{print $2}')" = "$CFT_VERSION"
    rm /tmp/chrome.zip /tmp/chromedriver.zip /tmp/cft-release.json
    rm -r /tmp/cft-driver
    ;;
  *) echo "Unsupported Selenium browser: $SELENIUM_BROWSER" >&2; exit 1 ;;
esac
