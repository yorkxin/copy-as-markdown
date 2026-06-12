FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /workspace

RUN apt update && apt install -y xsel

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN mkdir -p src/vendor/ dist/
RUN npm ci

# Copy the rest of the source
COPY . .

# Listen HTML reporter on 0.0.0.0 so that the port can be forwarded
ENV PLAYWRIGHT_HTML_HOST=0.0.0.0

# Default command mirrors the GitHub Actions job (headless via Xvfb)
COPY docker/playwright-ci/run-playwright.sh /usr/local/bin/run-playwright.sh
RUN chmod +x /usr/local/bin/run-playwright.sh
ENTRYPOINT ["/usr/local/bin/run-playwright.sh"]
