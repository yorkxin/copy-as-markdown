# Containerized Claude Code Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone Docker sandbox in which a Claude Code session can run `claude --dangerously-skip-permissions` and execute the full gate plus the e2e suite in one isolated container, with default-deny network egress and a persisted login.

**Architecture:** A new `docker/claude-sandbox/` image built **FROM the same Playwright base** as the e2e harness, so the container *is* the e2e environment (no nested Docker). An entrypoint applies an iptables/ipset firewall as root, installs Linux-native `node_modules` into a named volume, then drops to non-root `pwuser` to run the requested command. A host helper script wires up caps, mounts, and named volumes (working tree rw; `node_modules` and `~/.claude` as volumes; nothing else from `$HOME`).

**Tech Stack:** Docker, bash, iptables/ipset, `setpriv` (util-linux, privilege drop), the Playwright `noble` base image (Node 24), `@anthropic-ai/claude-code`.

**Note on TDD:** This is declarative infra (Dockerfile + shell), so there are no unit tests to fail-first. Each task instead ends with **verification commands and their expected output** — run them and confirm before committing. Treat a failing verification exactly like a failing test: stop and fix before moving on.

**Reference spec:** [docs/superpowers/specs/2026-06-20-claude-sandbox-design.md](../specs/2026-06-20-claude-sandbox-design.md)

**Known facts (verified against the base image):**
- Base image `mcr.microsoft.com/playwright:v1.57.0-noble` ships Node v24, `git`, `curl`.
- Non-root user is **`pwuser`, uid/gid 1001**, home `/home/pwuser`.
- Missing tools to install: `iptables`, `ipset`, `jq`, `dnsutils` (for `dig`), `gh`, `xsel`.
  (`setpriv`, used for the privilege drop, is already present via util-linux — no install.)
- Playwright browsers live at `/ms-playwright` (preset via `PLAYWRIGHT_BROWSERS_PATH`); no browser download needed.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `docker/claude-sandbox/Dockerfile` | Build the sandbox image FROM the Playwright base; add firewall/clipboard/CLI tooling + Claude Code. |
| `docker/claude-sandbox/init-firewall.sh` | Default-deny iptables/ipset egress allowlist (Anthropic + npm + GitHub + DNS). |
| `docker/claude-sandbox/entrypoint.sh` | (root) apply firewall → ensure volume ownership → `npm ci` into volume if lockfile changed → `exec setpriv` to drop to pwuser. |
| `docker/claude-sandbox/claude-sandbox.sh` | Host helper: build image, create volumes, `docker run` with caps/mounts. |
| `DEVELOPMENT.md` | New section documenting how to launch the sandbox and run the gate + e2e. |

All work happens on the existing `claude-sandbox` branch.

---

## Task 1: Scaffold the sandbox image (Dockerfile)

**Files:**
- Create: `docker/claude-sandbox/Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

Create `docker/claude-sandbox/Dockerfile` with exactly this content:

```dockerfile
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

# Firewall + entrypoint scripts (added in later tasks; COPY now so the image layout is fixed).
COPY docker/claude-sandbox/init-firewall.sh /usr/local/bin/init-firewall.sh
COPY docker/claude-sandbox/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
```

- [ ] **Step 2: Create placeholder scripts so the COPY succeeds**

The Dockerfile COPYs two scripts that later tasks fill in. Create minimal placeholders now so Task 1 builds:

`docker/claude-sandbox/init-firewall.sh`:
```bash
#!/bin/bash
echo "[firewall] placeholder — replaced in Task 2"
```

`docker/claude-sandbox/entrypoint.sh`:
```bash
#!/bin/bash
exec "$@"
```

- [ ] **Step 3: Build the image**

Run:
```bash
docker build -t copy-as-markdown-claude-sandbox -f docker/claude-sandbox/Dockerfile .
```
Expected: build completes successfully (`naming to ... copy-as-markdown-claude-sandbox`).

- [ ] **Step 4: Verify the toolchain and Claude Code are present**

Run:
```bash
docker run --rm copy-as-markdown-claude-sandbox bash -lc \
  'id pwuser; claude --version; for t in iptables ipset setpriv jq dig gh xsel; do command -v $t >/dev/null && echo "have $t" || echo "MISSING $t"; done'
```
Expected: `uid=1001(pwuser)`, a Claude Code version string, and `have …` for every tool (no `MISSING`).

- [ ] **Step 5: Commit**

```bash
git add docker/claude-sandbox/Dockerfile docker/claude-sandbox/init-firewall.sh docker/claude-sandbox/entrypoint.sh
git commit -m "feat(sandbox): scaffold Claude Code sandbox image"
```

---

## Task 2: Network firewall (init-firewall.sh)

**Files:**
- Modify (replace placeholder): `docker/claude-sandbox/init-firewall.sh`

- [ ] **Step 1: Write the firewall script**

Replace the entire contents of `docker/claude-sandbox/init-firewall.sh` with:

```bash
#!/bin/bash
# Default-deny outbound egress with an allowlist, applied at container start (needs root +
# --cap-add=NET_ADMIN). Allows: DNS, loopback, established connections, and a fixed set of
# hosts (Anthropic API + auth, npm registry, GitHub). Everything else is dropped.
#
# PROVENANCE: derived from Anthropic's reference Claude Code devcontainer firewall:
#   https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh
#   (derived 2026-06-20). This is a vendored copy — Anthropic does not distribute it as a
#   package. To check for upstream improvements, diff this file against that URL periodically.
#   Local deltas from upstream: simplified to IPv4-only ipset (no `aggregate` dependency) and a
#   fixed hostname allowlist instead of reading domains from a config file.
#
# Resolution (dig/curl) runs BEFORE the default policy flips to DROP, so it relies on the
# post-flush default-ACCEPT state. Order matters — do not move the policy lines up.
set -euo pipefail
IFS=$'\n\t'

echo "[firewall] resetting rules..."
iptables -F
iptables -X
iptables -t nat -F 2>/dev/null || true
iptables -t mangle -F 2>/dev/null || true
ipset destroy allowed-domains 2>/dev/null || true

# Loopback always allowed.
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# DNS must work before we resolve allowlisted hostnames.
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT  -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT  -p tcp --sport 53 -j ACCEPT

ipset create allowed-domains hash:net family inet

# --- GitHub IP ranges (web + api + git) from the meta API. IPv4 CIDRs only (ipset family inet).
echo "[firewall] fetching GitHub IP ranges..."
gh_meta="$(curl -fsS https://api.github.com/meta || echo '{}')"
echo "$gh_meta" | jq -r '[.web[]?, .api[]?, .git[]?] | .[]' 2>/dev/null \
  | grep -E '^[0-9]+(\.[0-9]+){3}/[0-9]+$' \
  | while read -r cidr; do ipset add allowed-domains "$cidr" 2>/dev/null || true; done

# --- Hostname allowlist. Resolve A records and add each IP.
for domain in \
  registry.npmjs.org \
  api.anthropic.com \
  console.anthropic.com \
  claude.ai \
  statsig.anthropic.com \
  github.com \
  api.github.com \
  codeload.github.com \
  objects.githubusercontent.com; do
  echo "[firewall] resolving $domain..."
  for ip in $(dig +short A "$domain" | grep -E '^[0-9]+(\.[0-9]+){3}$' || true); do
    ipset add allowed-domains "$ip" 2>/dev/null || true
  done
done

# Allow established/related and traffic to the allowlisted set.
iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Lock down: drop everything not explicitly allowed above.
iptables -P INPUT   DROP
iptables -P FORWARD DROP
iptables -P OUTPUT  DROP

echo "[firewall] active. Allowlisted entries: $(ipset list allowed-domains | grep -c '^[0-9]')"
```

- [ ] **Step 2: Rebuild the image with the real firewall**

Run:
```bash
docker build -t copy-as-markdown-claude-sandbox -f docker/claude-sandbox/Dockerfile .
```
Expected: build succeeds.

- [ ] **Step 3: Verify the firewall allows allowlisted hosts and blocks others**

Run (note the caps — the firewall needs `NET_ADMIN`/`NET_RAW`):
```bash
docker run --rm --cap-add=NET_ADMIN --cap-add=NET_RAW copy-as-markdown-claude-sandbox bash -lc '
  /usr/local/bin/init-firewall.sh
  echo "--- allowlisted (expect 200/OK) ---"
  curl -s -o /dev/null -w "registry.npmjs.org -> %{http_code}\n" https://registry.npmjs.org/ || true
  curl -s -o /dev/null -w "api.github.com   -> %{http_code}\n" https://api.github.com/   || true
  echo "--- blocked (expect timeout/failure) ---"
  curl -s --max-time 5 -o /dev/null -w "example.com -> %{http_code}\n" https://example.com/ || echo "example.com -> BLOCKED (good)"
'
```
Expected: `registry.npmjs.org -> 200` and `api.github.com -> 200` (or another 2xx/3xx), and `example.com -> BLOCKED (good)`.

- [ ] **Step 4: Commit**

```bash
git add docker/claude-sandbox/init-firewall.sh docker/claude-sandbox/Dockerfile
git commit -m "feat(sandbox): default-deny egress firewall with allowlist"
```

---

## Task 3: Entrypoint (firewall + deps + privilege drop)

**Files:**
- Modify (replace placeholder): `docker/claude-sandbox/entrypoint.sh`

- [ ] **Step 1: Write the entrypoint**

Replace the entire contents of `docker/claude-sandbox/entrypoint.sh` with:

```bash
#!/bin/bash
# Entrypoint runs as root (required for iptables). It applies the firewall, prepares the
# mounted volumes, installs Linux-native node_modules on first run / lockfile change, then drops
# to the non-root pwuser to run the requested command (default: bash).
#
# Privilege drop uses `setpriv` (from util-linux, already in the Playwright base image — zero
# added dependency). Like gosu, it does a clean exec-based drop, so signals and exit codes pass
# straight through to the child. `--init-groups` initializes pwuser's supplementary groups. The
# numeric uid/gid 1001 is pwuser in this base image (kept literal for portability).
#
# setpriv changes ONLY process credentials, not the environment — so we must set HOME/USER for
# the dropped child via `env`. Without it HOME stays /root: npm hits EACCES on /root/.npm, and
# Claude Code would look for ~/.claude in /root instead of the mounted /home/pwuser volume.
set -euo pipefail

SANDBOX_USER=pwuser   # used below only for chown/mkdir of the mounted volumes

# 1. Apply the egress firewall. Requires --cap-add=NET_ADMIN; warn (don't fail) if unavailable
#    so the container is still usable for a no-network inspection.
if [ "$(id -u)" = "0" ]; then
  if /usr/local/bin/init-firewall.sh; then
    echo "[sandbox] firewall applied"
  else
    echo "[sandbox] WARNING: firewall failed to apply (did you pass --cap-add=NET_ADMIN?)" >&2
  fi
else
  echo "[sandbox] not root; skipping firewall" >&2
fi

# 2. Make the named volumes writable by the non-root user.
mkdir -p "/home/$SANDBOX_USER/.claude" /workspace/node_modules
chown "$SANDBOX_USER:$SANDBOX_USER" "/home/$SANDBOX_USER/.claude" /workspace/node_modules || true

# 3. Install dependencies into the node_modules volume when the lockfile hash changes.
if [ -f /workspace/package-lock.json ]; then
  lock_hash="$(sha256sum /workspace/package-lock.json | cut -d' ' -f1)"
  stamp=/workspace/node_modules/.lock-hash
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_hash" ]; then
    echo "[sandbox] installing dependencies (npm ci)..."
    setpriv --reuid=1001 --regid=1001 --init-groups \
      env "HOME=/home/$SANDBOX_USER" "USER=$SANDBOX_USER" bash -lc 'cd /workspace && npm ci'
    echo "$lock_hash" | setpriv --reuid=1001 --regid=1001 --init-groups \
      env "HOME=/home/$SANDBOX_USER" "USER=$SANDBOX_USER" tee "$stamp" >/dev/null
  else
    echo "[sandbox] dependencies up to date"
  fi
fi

# 4. Drop privileges and run the requested command.
exec setpriv --reuid=1001 --regid=1001 --init-groups \
  env "HOME=/home/$SANDBOX_USER" "USER=$SANDBOX_USER" "$@"
```

- [ ] **Step 2: Rebuild the image**

Run:
```bash
docker build -t copy-as-markdown-claude-sandbox -f docker/claude-sandbox/Dockerfile .
```
Expected: build succeeds.

- [ ] **Step 3: Verify entrypoint installs deps and drops privileges**

Run (mount the tree + a throwaway node_modules volume; first run will `npm ci`):
```bash
docker run --rm --cap-add=NET_ADMIN --cap-add=NET_RAW --shm-size=1g \
  -v "$(pwd)":/workspace \
  -v claude-sandbox-test-nm:/workspace/node_modules \
  copy-as-markdown-claude-sandbox \
  bash -lc 'whoami; echo "HOME=$HOME"; node -e "require(\"esbuild\"); console.log(\"esbuild loads on linux OK\")"'
```
Expected: `[sandbox] firewall applied`, an `npm ci` run that **succeeds** (not an EACCES on `/root/.npm`), then `pwuser`, `HOME=/home/pwuser`, and `esbuild loads on linux OK` (proving the privilege drop sets HOME correctly and the Linux-native deps are in the volume, not the host's darwin binaries).

- [ ] **Step 4: Verify second run skips reinstall**

Run the same command again. Expected: `[sandbox] dependencies up to date` (no second `npm ci`), then `pwuser` / `esbuild loads on linux OK`.

- [ ] **Step 5: Clean up the throwaway volume**

```bash
docker volume rm claude-sandbox-test-nm
```

- [ ] **Step 6: Commit**

```bash
git add docker/claude-sandbox/entrypoint.sh
git commit -m "feat(sandbox): entrypoint — firewall, deps, privilege drop"
```

---

## Task 4: Host helper script (claude-sandbox.sh)

**Files:**
- Create: `docker/claude-sandbox/claude-sandbox.sh`

- [ ] **Step 1: Write the helper**

Create `docker/claude-sandbox/claude-sandbox.sh` with:

```bash
#!/usr/bin/env bash
# Host-side launcher for the Claude Code sandbox.
#
# Builds the image, ensures the named volumes exist, and runs the container with the network
# caps + mounts the sandbox needs. The working tree is bind-mounted read-write at /workspace
# (including .git); node_modules and ~/.claude are named volumes. NOTHING else from $HOME is
# mounted — not ~/.ssh, ~/.aws, ~/.npmrc, nor the macOS Keychain.
#
# Auth: a persisted login lives in the home volume. Default volume `claude-sandbox-home` is
# shared across sessions — log in once, reused everywhere (token auto-refreshes). Set
# CLAUDE_SANDBOX_HOME=<name> to use an isolated home volume for a parallel/per-task sandbox
# (that volume needs its own one-time login).
#
# Usage:
#   docker/claude-sandbox/claude-sandbox.sh                 # build + drop into a shell
#   docker/claude-sandbox/claude-sandbox.sh claude --dangerously-skip-permissions
#   CLAUDE_SANDBOX_HOME=task-foo docker/claude-sandbox/claude-sandbox.sh
#
# Any arguments are passed through as the container command (default: bash).
set -uo pipefail

IMAGE=copy-as-markdown-claude-sandbox
LABEL=com.copy-as-markdown.image=claude-sandbox
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

HOME_VOLUME="claude-sandbox-home${CLAUDE_SANDBOX_HOME:+-$CLAUDE_SANDBOX_HOME}"
NODE_MODULES_VOLUME="claude-sandbox-node-modules"

docker build -t "$IMAGE" -f "$ROOT/docker/claude-sandbox/Dockerfile" "$ROOT" || exit $?

docker volume create "$HOME_VOLUME" >/dev/null
docker volume create "$NODE_MODULES_VOLUME" >/dev/null

echo "[sandbox] home volume: $HOME_VOLUME   node_modules volume: $NODE_MODULES_VOLUME"

# Allocate an interactive TTY only when we actually have one (so a piped/non-interactive
# `claude-sandbox.sh some-command` still works instead of erroring "input device is not a TTY").
# The `[@]+...` guard keeps the empty-array expansion safe under `set -u` on bash 3.2 (macOS).
tty_flags=()
[ -t 0 ] && [ -t 1 ] && tty_flags=(-it)

docker run --rm ${tty_flags[@]+"${tty_flags[@]}"} \
  --cap-add=NET_ADMIN --cap-add=NET_RAW \
  --shm-size=1g \
  -v "$ROOT":/workspace \
  -v "$NODE_MODULES_VOLUME":/workspace/node_modules \
  -v "$HOME_VOLUME":/home/pwuser/.claude \
  "$IMAGE" "$@"
code=$?

# Prune dangling images orphaned by this project's previous sandbox builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

exit "$code"
```

- [ ] **Step 2: Make it executable**

Run:
```bash
chmod +x docker/claude-sandbox/claude-sandbox.sh
```

- [ ] **Step 3: Verify the helper launches and mounts correctly**

Run a non-interactive smoke (override the default bash with a command; `-it` is harmless here):
```bash
docker/claude-sandbox/claude-sandbox.sh bash -lc 'echo "user=$(whoami)"; ls /workspace/package.json; test -d /workspace/node_modules && echo "node_modules mounted"'
```
Expected: image builds (or uses cache), volumes created, then `user=pwuser`, the path to `package.json`, and `node_modules mounted`. (First run also performs `npm ci`.)

- [ ] **Step 4: Verify the per-task home-volume override**

Run:
```bash
CLAUDE_SANDBOX_HOME=demo docker/claude-sandbox/claude-sandbox.sh bash -lc 'true'
docker volume ls | grep claude-sandbox-home
```
Expected: both `claude-sandbox-home-demo` (from this run) and, if you ran Step 3, `claude-sandbox-home` are listed. Clean up the demo volume: `docker volume rm claude-sandbox-home-demo`.

- [ ] **Step 5: Commit**

```bash
git add docker/claude-sandbox/claude-sandbox.sh
git commit -m "feat(sandbox): host launcher with caps, mounts, auth volume scoping"
```

---

## Task 5: End-to-end verification — full gate + e2e inside the sandbox

This task runs no new code; it proves the sandbox satisfies the spec's acceptance criteria. Nothing is committed unless a fix is needed.

- [ ] **Step 1: Run the full gate inside the sandbox**

Run:
```bash
docker/claude-sandbox/claude-sandbox.sh bash -lc \
  'npm run typecheck && npm run lint && npm test && npm run build'
```
Expected: all four stages pass (tsc clean, eslint clean, vitest all green, both builds produced). The vitest `browser` project uses the base image's Chromium.

- [ ] **Step 2: Run the e2e suite inside the sandbox via the existing harness script**

Run (set `CI=true` — without it the Playwright config uses the auto-serving `html` reporter that **blocks forever** and never writes `results.json`; the e2e Docker image sets this via `ENV`, but the general-purpose sandbox image does not):
```bash
docker/claude-sandbox/claude-sandbox.sh bash -lc \
  'CI=true bash docker/playwright-ci/run-playwright.sh'
```
Expected: the Playwright suite (both `parallel-tests` and `clipboard-smoke` projects) runs to completion under Xvfb using the **container's** clipboard, and the process exits with a real code. Read the authoritative result from `test-results/results.json` on the host:
```bash
jq '.suites[].specs[] | select(.ok==false)' test-results/results.json
```
Expected: no output (no failing specs). If the known clipboard/tab-exporting flake trips, re-run it in isolation inside the sandbox (still `CI=true` so the reporter doesn't hang; `--retries=0` overrides the CI retry count):
```bash
docker/claude-sandbox/claude-sandbox.sh bash -lc \
  'CI=true xvfb-run -a npx playwright test --project=clipboard-smoke --retries=0'
```

- [ ] **Step 3: Confirm the host clipboard was untouched**

The container uses its own Xvfb clipboard, so your host clipboard should be unchanged by Step 2. This is informational — no command needed beyond noting your host clipboard still holds whatever it did before.

- [ ] **Step 4: No commit**

This task only verifies. If any step failed and required a fix to a Task 1–4 file, commit that fix with a descriptive message and re-run the failed step.

---

## Task 6: Document the sandbox in DEVELOPMENT.md

**Files:**
- Modify: `DEVELOPMENT.md` (add a new section after "## E2E tests (Playwright)" / before "## Debugging the extension")

- [ ] **Step 1: Add the sandbox section**

Insert this section into `DEVELOPMENT.md` immediately before the `## Debugging the extension` heading:

```markdown
## Claude Code sandbox (isolated `--dangerously-skip-permissions`)

[docker/claude-sandbox/](docker/claude-sandbox/) provides an isolated container for running a
Claude Code session with `claude --dangerously-skip-permissions` (full permissions, no prompts)
without risking the host. It is built **from the same Playwright base image as the e2e harness**,
so the *same* container runs the full gate **and** the e2e suite — no nested Docker.

> The container protects your **host**, not the repo's git history: the working tree is
> bind-mounted read-write (including `.git`). Your `~/.ssh`, `~/.aws`, `~/.npmrc`, and macOS
> Keychain are **not** mounted.

### Launch

```sh
docker/claude-sandbox/claude-sandbox.sh                 # build (first run) + drop into a shell
docker/claude-sandbox/claude-sandbox.sh claude --dangerously-skip-permissions   # or launch Claude directly
```

First launch installs Linux-native `node_modules` into a named volume (the host's macOS
`node_modules` is never used inside the container) and applies a default-deny network firewall
that allows only the Anthropic API + auth, the npm registry, and GitHub.

### Auth (log in once)

A persisted login lives in a named volume. The default volume `claude-sandbox-home` is shared
across sessions: **log in once** (run `claude` and complete the OAuth flow), and every later
session — including separate dev tasks — reuses the token, which auto-refreshes. Set
`CLAUDE_SANDBOX_HOME=<name>` to use an isolated home volume for a parallel/per-task sandbox (that
volume needs its own one-time login). `ANTHROPIC_API_KEY` works as an alternative if you prefer
not to log in interactively.

### Running the gate and e2e inside the sandbox

```sh
npm run typecheck && npm run lint && npm test && npm run build   # gate
CI=true bash docker/playwright-ci/run-playwright.sh              # e2e under Xvfb (CI parity)
```

The e2e path reuses the existing harness script — there is no separate npm script. `CI=true` is
required so Playwright uses the non-blocking reporters (and writes `test-results/results.json`)
instead of the auto-serving `html` report that would hang; the e2e Docker image sets this via
`ENV`, but this general-purpose sandbox image does not. The container has its own Xvfb display and
clipboard, so the clipboard-smoke project never touches your host clipboard. Results land in the
bind-mounted `test-results/` and `playwright-report/` as usual; the known clipboard/tab-exporting
flake is re-run in isolation with
`CI=true xvfb-run -a npx playwright test --project=clipboard-smoke --retries=0`.
```

- [ ] **Step 2: Verify the doc renders and links resolve**

Run:
```bash
grep -n "Claude Code sandbox" DEVELOPMENT.md
ls docker/claude-sandbox/claude-sandbox.sh
```
Expected: the new heading is found, and the referenced script exists.

- [ ] **Step 3: Commit**

```bash
git add DEVELOPMENT.md
git commit -m "docs: document the Claude Code sandbox in DEVELOPMENT.md"
```

---

## Done

The branch `claude-sandbox` now contains: the sandbox image, firewall, entrypoint, host launcher,
and documentation, with the gate and e2e verified to run inside the container. Open a PR when ready
(host step — push and `gh pr create`).
```

