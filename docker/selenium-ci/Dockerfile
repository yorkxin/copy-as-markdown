FROM ubuntu:24.04

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
      gnupg \
      software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# --- Firefox from Mozilla APT (bypasses Ubuntu 24.04's snap-transition package)
RUN install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://packages.mozilla.org/apt/repo-signing-key.gpg \
       -o /etc/apt/keyrings/packages.mozilla.org.asc \
    && echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" \
       > /etc/apt/sources.list.d/mozilla.list \
    && printf 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000\n' \
       > /etc/apt/preferences.d/mozilla \
    && apt-get update && apt-get install -y --no-install-recommends firefox \
    && rm -rf /var/lib/apt/lists/*

# --- geckodriver (arch-aware binary from GitHub releases) -------------------
# firefox-geckodriver is not available on arm64; download the appropriate binary.
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

# --- Python 3.14 from deadsnakes PPA ----------------------------------------
RUN add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
      python3.14 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://bootstrap.pypa.io/get-pip.py | python3.14

# --- Node.js 22 (lts/krypton) via NodeSource --------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Python dependencies ----------------------------------------------------
# pyautogui pulls in python-xlib / mouseinfo automatically.
COPY requirements.txt ./
RUN python3.14 -m pip install --no-cache-dir -r requirements.txt

# --- Node dependencies (cached layer) ----------------------------------------
COPY package.json package-lock.json* ./
RUN mkdir -p src/vendor/ dist/ \
    && npm ci

# --- Extension source -------------------------------------------------------
COPY . .

COPY docker/selenium-ci/run-selenium.sh /usr/local/bin/run-selenium.sh
RUN chmod +x /usr/local/bin/run-selenium.sh

ENTRYPOINT ["/usr/local/bin/run-selenium.sh"]
