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

# firefox-esr ships in Debian's main repo and satisfies manifest.json's
# requires_min (139) as long as the current ESR major stays above it (140 as
# of this writing). If requires_min is ever bumped past the current ESR major,
# switch to release Firefox via Mozilla APT instead:
#
#   install -d -m 0755 /etc/apt/keyrings
#   curl -fsSL https://packages.mozilla.org/apt/repo-signing-key.gpg \
#        -o /etc/apt/keyrings/packages.mozilla.org.asc
#   echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] \
#        https://packages.mozilla.org/apt mozilla main" \
#        > /etc/apt/sources.list.d/mozilla.list
#   printf 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000\n' \
#        > /etc/apt/preferences.d/mozilla
#   apt-get update && apt-get install -y firefox
#
RUN apt-get update && apt-get install -y --no-install-recommends \
      firefox-esr \
    && rm -rf /var/lib/apt/lists/*

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

# Chromium + matching driver for the Chrome AT-SPI smoke spike. Debian's
# chromium-driver is version-matched to the chromium package, so no runtime
# Selenium Manager driver download is needed.
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

ENTRYPOINT ["/usr/local/bin/run-selenium.sh"]
