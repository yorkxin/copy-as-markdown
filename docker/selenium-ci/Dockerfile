FROM python:3.14-slim

# The label lets docker-e2e.sh prune only images orphaned by this project's
# own rebuilds, without touching dangling images from other projects.
LABEL com.copy-as-markdown.image=selenium-e2e

ENV DEBIAN_FRONTEND=noninteractive
ENV CI=true

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Mozilla release archives support the exact minimum version on both host arches.
ARG TARGETARCH
ARG FIREFOX_VERSION=139.0
ENV FIREFOX_VERSION=${FIREFOX_VERSION}
ENV FIREFOX_BINARY=/opt/firefox/firefox
RUN apt-get update && apt-get install -y --no-install-recommends \
      xz-utils libgtk-3-0 libdbus-glib-1-2 libasound2 libxt6 libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) FF_ARCH=linux-x86_64 ;; \
      arm64) FF_ARCH=linux-aarch64 ;; \
      *) echo "Unsupported architecture: $TARGETARCH"; exit 1 ;; \
    esac; \
    RELEASE="https://archive.mozilla.org/pub/firefox/releases/${FIREFOX_VERSION}"; \
    ARCHIVE="${FF_ARCH}/en-US/firefox-${FIREFOX_VERSION}.tar.xz"; \
    curl -fsSL --retry 3 "$RELEASE/$ARCHIVE" -o /tmp/firefox.tar.xz; \
    curl -fsSL --retry 3 "$RELEASE/SHA256SUMS" -o /tmp/SHA256SUMS; \
    awk -v archive="$ARCHIVE" '$2 == archive {print $1 "  /tmp/firefox.tar.xz"}' \
      /tmp/SHA256SUMS > /tmp/firefox.sha256; \
    test "$(wc -l < /tmp/firefox.sha256)" -eq 1; \
    sha256sum -c /tmp/firefox.sha256; \
    mkdir -p /opt/firefox; \
    tar -xJf /tmp/firefox.tar.xz -C /opt; \
    ln -s /opt/firefox/firefox /usr/local/bin/firefox; \
    test "$(firefox --version)" = "Mozilla Firefox ${FIREFOX_VERSION}"; \
    cp /tmp/firefox.sha256 /opt/firefox/archive.sha256; \
    rm /tmp/firefox.tar.xz /tmp/SHA256SUMS /tmp/firefox.sha256

# geckodriver is not packaged in Debian; download the release binary directly.
ARG GECKODRIVER_VERSION=0.35.0
RUN set -eux; \
    ARCH="$(uname -m)"; \
    case "$ARCH" in \
      x86_64)  GD_ARCH="linux64" ;; \
      aarch64) GD_ARCH="linux-aarch64" ;; \
      *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
    esac; \
    curl -fsSL \
      "https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-${GD_ARCH}.tar.gz" \
      | tar xz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/geckodriver

# Chromium + matching driver.
# Debian's chromium-driver is version-matched to the chromium package, 
# so no runtime Selenium Manager driver download is needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# xvfb: headless display   xauth: required by xvfb-run   xsel: real clipboard
# xdotool: X11 key injection for extension keyboard shortcuts
# at-spi2-core + dbus: accessibility bus for native context-menu testing
# GI dev libs + atspi typelib: let pip-built PyGObject bind to Atspi under py3.14
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb \
      xauth \
      xsel \
      xdotool \
      at-spi2-core \
      dbus \
      libgirepository-2.0-dev \
      gir1.2-atspi-2.0 \
      libcairo2-dev \
      pkg-config \
      gcc \
    && rm -rf /var/lib/apt/lists/*

# Node.js 24 — not in Debian's repos at this version
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Separate COPY so the npm layer is cached independently of source changes
COPY package.json package-lock.json* ./
RUN mkdir -p src/vendor/ dist/ \
    && npm ci

COPY . .

COPY docker/selenium-ci/run-selenium.sh /usr/local/bin/run-selenium.sh
RUN chmod +x /usr/local/bin/run-selenium.sh

# Drop to a non-root user for the test run (defense in depth). Created after all
# root-only install steps; /workspace is handed over so the runtime
# `npm run test:e2e:build` can write the test extensions. (Chromium still needs
# --no-sandbox even non-root — this container does not permit its namespace
# sandbox; see e2e_test/conftest.py.)
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /workspace
USER appuser

ENTRYPOINT ["/usr/local/bin/run-selenium.sh"]
