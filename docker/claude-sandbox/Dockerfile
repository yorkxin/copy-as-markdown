# Sandbox image for running Claude Code with --dangerously-skip-permissions in isolation.
# Built FROM the same Playwright base as docker/playwright-ci/Dockerfile so the SAME container
# can run the full gate AND the e2e suite under Xvfb — no nested Docker. Keep the base image tag
# aligned with docker/playwright-ci/Dockerfile and .node-version when bumping either.
FROM mcr.microsoft.com/playwright:v1.57.0-noble

# Label so host-side pruning (claude-sandbox.sh) can scope to this project's images only.
LABEL com.copy-as-markdown.image=claude-sandbox

# Tooling:
#   xsel              - clipboard for the e2e clipboard-smoke project (matches the e2e image)
#   iptables, ipset   - default-deny egress firewall applied at container start
#   jq, dnsutils      - firewall script: parse GitHub IP ranges, resolve allowlisted hostnames
#   ca-certificates   - TLS roots for curl/gh/npm
# The entrypoint drops from root to pwuser with `setpriv`, which ships in util-linux in the base
# image — so it is intentionally NOT in this install list (no added dependency).
RUN apt-get update && apt-get install -y --no-install-recommends \
      xsel iptables ipset jq dnsutils ca-certificates curl gnupg \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI (gh) from the official apt repo.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (global).
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

# Firewall + entrypoint scripts.
COPY docker/claude-sandbox/init-firewall.sh /usr/local/bin/init-firewall.sh
COPY docker/claude-sandbox/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
