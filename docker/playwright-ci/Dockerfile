FROM mcr.microsoft.com/playwright:v1.61.0-noble

# Label so the host wrapper (docker/playwright-ci/docker-e2e.sh) can prune ONLY the
# images this project's rebuilds orphan, leaving other projects' dangling images alone.
LABEL com.copy-as-markdown.image=playwright-e2e

WORKDIR /workspace

RUN apt update && apt install -y xsel

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN mkdir -p src/vendor/ dist/
RUN npm ci

# Copy the rest of the source
COPY . .

# Run exactly like the GitHub Actions job: CI=true turns on retries, forbids
# stray test.only, disables fixture-server reuse, and (with the reporter config in
# playwright.config.ts) selects the non-blocking list+json+html reporters so the
# container exits with a real code instead of hanging on the HTML report server.
ENV CI=true

# Bind the HTML report server to 0.0.0.0 in case someone forwards a port to view it
# interactively; the default CI run generates the report with open:'never' and does
# not serve it, so the container still exits on its own.
ENV PLAYWRIGHT_HTML_HOST=0.0.0.0

# Default command mirrors the GitHub Actions job (headless via Xvfb)
COPY docker/playwright-ci/run-playwright.sh /usr/local/bin/run-playwright.sh
RUN chmod +x /usr/local/bin/run-playwright.sh
ENTRYPOINT ["/usr/local/bin/run-playwright.sh"]
