FROM python:3.14-slim

# Label so the host wrapper can prune ONLY images this project's rebuilds orphan,
# leaving other projects' dangling images alone.
LABEL com.copy-as-markdown.image=selenium-e2e

ENV DEBIAN_FRONTEND=noninteractive
ENV CI=true

WORKDIR /workspace

# --- Base system tools ------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Firefox ESR (Debian bookworm ships firefox-esr in main; no snap) -------
#
# We use firefox-esr rather than release Firefox (packages.mozilla.org/apt)
# because it ships cleanly in Debian's repos with no extra configuration.
#
# Trade-off: ESR lags the release channel by ~3 major versions. As of this
# writing, firefox-esr is ~140 and the manifest.json requires_min is 139, so
# ESR is a valid test target. If requires_min is ever bumped past the current
# ESR major version, switch to Mozilla APT release Firefox:
#
#   install -d -m 0755 /etc/apt/keyrings
#   curl -fsSL https://packages.mozilla.org/apt/repo-signing-key.gpg \
#        -o /etc/apt/keyrings/packages.mozilla.org.asc
#   echo "deb [signed-by=...] https://packages.mozilla.org/apt mozilla main" \
#        > /etc/apt/sources.list.d/mozilla.list
#   printf 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000\n' \
#        > /etc/apt/preferences.d/mozilla
#   apt-get update && apt-get install -y firefox
#
RUN apt-get update && apt-get install -y --no-install-recommends \
      firefox-esr \
    && rm -rf /var/lib/apt/lists/*

# --- geckodriver (arch-aware binary from GitHub releases) -------------------
# Not packaged in Debian; download the appropriate binary for the build arch.
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

# --- xvfb, xauth, xsel, xdotool (virtual display + real clipboard + key injection) --
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb \
      xauth \
      xsel \
      xdotool \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 22 (lts/jod) via NodeSource ------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Python dependencies ----------------------------------------------------
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# --- Node dependencies (cached layer) ----------------------------------------
COPY package.json package-lock.json* ./
RUN mkdir -p src/vendor/ dist/ \
    && npm ci

# --- Extension source -------------------------------------------------------
COPY . .

COPY docker/selenium-ci/run-selenium.sh /usr/local/bin/run-selenium.sh
RUN chmod +x /usr/local/bin/run-selenium.sh

ENTRYPOINT ["/usr/local/bin/run-selenium.sh"]
