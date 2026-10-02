FROM python:3.14-slim AS common

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

# Runtime libraries are explicit because official archives have no APT dependencies.
RUN apt-get update && apt-get install -y --no-install-recommends \
      xz-utils unzip libgtk-3-0 libdbus-glib-1-2 libasound2 libxt6 libx11-xcb1 \
      libnss3 libgbm1 libxss1 libxdamage1 libxrandr2 fonts-liberation \
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

ENV FIREFOX_BINARY=/opt/firefox/firefox
ENV CHROME_BINARY=/opt/cft/chrome/chrome
ENV CHROMEDRIVER_BINARY=/usr/local/bin/chromedriver
COPY docker/selenium-ci/install-browser.sh /usr/local/bin/install-browser.sh

# Independent browser stages keep a CfT update from re-downloading Firefox.
FROM common AS firefox-browser
ARG TARGETARCH
ARG FIREFOX_VERSION=139.0
ARG GECKODRIVER_VERSION=0.35.0
RUN SELENIUM_BROWSER=firefox bash /usr/local/bin/install-browser.sh

FROM common AS cft-browser
ARG TARGETARCH
ARG CFT_VERSION
ARG CFT_CHROME_URL
ARG CFT_DRIVER_URL
RUN SELENIUM_BROWSER=cft bash /usr/local/bin/install-browser.sh

FROM common AS environment
ARG FIREFOX_VERSION=139.0
ARG CFT_VERSION
ENV BROWSER=all
ENV FIREFOX_VERSION=${FIREFOX_VERSION}
ENV CFT_VERSION=${CFT_VERSION}
COPY --from=firefox-browser /opt/firefox /opt/firefox
COPY --from=firefox-browser /usr/local/bin/geckodriver /usr/local/bin/geckodriver
COPY --from=cft-browser /opt/cft /opt/cft
COPY --from=cft-browser /usr/local/bin/chromedriver /usr/local/bin/chromedriver

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
