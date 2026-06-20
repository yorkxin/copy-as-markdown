# Containerized Claude Code sandbox — design

**Date:** 2026-06-20
**Status:** Approved (pending implementation plan)

## Goal

Provide a reproducible, isolated container in which a Claude Code session can run with
`claude --dangerously-skip-permissions` (full permissions, zero prompts) without risking the
host machine, and in which the session can execute the **entire local gate plus the e2e suite**
with no permission prompts and no nested Docker:

```sh
npm run typecheck && npm run lint && npm test && npm run build   # gate
CI=true bash docker/playwright-ci/run-playwright.sh              # e2e, in-place under Xvfb
```

`--dangerously-skip-permissions` removes all guardrails, so it must only ever run inside this
isolated environment. The container protects the **host**; it does not protect the repo's git
history or anything explicitly mounted in. Mount only what is needed; restrict outbound network
to an allowlist.

## Decisions (brainstormed and approved)

1. **Packaging:** standalone Dockerfile + `docker run` helper script (not a VS Code devcontainer).
   Mirrors the existing `docker/playwright-ci/` convention (Dockerfile + shell orchestrator),
   is editor-agnostic, and gives a single command to drop into an isolated `claude` session.
2. **Base image:** extend the same Playwright base used by the e2e harness
   (`mcr.microsoft.com/playwright:v1.57.0-noble`). One container runs build + unit + e2e directly
   under Xvfb — **no Docker-in-Docker, no host Docker socket mount.**
3. **Claude Code auth:** persisted container-side login in a named volume (the host stores its
   token in the macOS Keychain, so there is no credential file to bind-mount). Log in once; the
   token persists across runs and auto-refreshes. `ANTHROPIC_API_KEY` is a documented alternative.
4. **Network:** default-deny outbound egress with an iptables/ipset allowlist applied at container
   start (Anthropic-reference `init-firewall.sh` pattern).
5. **Repo availability:** bind-mount the working tree read-write at `/workspace` (including `.git`,
   so the session can commit its own work). Deliberately do **not** mount other home-dir paths.

## Why no nested Docker (the e2e insight)

The repo's `npm run test:e2e:docker` builds and runs a Playwright container. Running that *inside*
the sandbox would require Docker-in-Docker or bind-mounting `/var/run/docker.sock` — both hand the
container control of the host Docker daemon, a trivial host-root escape that defeats the isolation
goal. **Rejected.**

Instead, because the sandbox image is built **from the same Playwright base** as the e2e harness,
the sandbox container **is** the e2e environment. The session runs the suite **directly in its own
container** via the same Xvfb invocation the harness uses today
(`docker/playwright-ci/run-playwright.sh`). The container has its **own** Xvfb display and its
**own** clipboard, so the `clipboard-smoke` project reads/writes the *container's* clipboard, never
the host's. Full CI parity, one box.

## Architecture

### File layout

```
docker/claude-sandbox/
  Dockerfile          # FROM mcr.microsoft.com/playwright:v1.57.0-noble
  init-firewall.sh    # default-deny iptables/ipset egress allowlist
  entrypoint.sh       # (root) run firewall → npm ci if needed → drop to non-root → exec cmd
  claude-sandbox.sh   # host helper: docker build + docker run with caps/mounts/volumes
```

Plus a new **DEVELOPMENT.md** section documenting how to launch the sandbox and run the gate + e2e.

### Image (`docker/claude-sandbox/Dockerfile`)

- `FROM mcr.microsoft.com/playwright:v1.57.0-noble` — browsers, fonts, system libs, and Node baked
  in. Keep aligned with `docker/playwright-ci/Dockerfile` when either is bumped.
- Adds:
  - `xsel` — clipboard support for the e2e clipboard-smoke project (same as the e2e image).
  - `iptables`, `ipset`, `sudo`, `gosu` — firewall application + privilege drop.
  - `git`, `gh` — version control and GitHub CLI for in-container work.
  - `npm install -g @anthropic-ai/claude-code` — the Claude Code CLI.
- Does **not** `COPY` repo source. The working tree is bind-mounted at runtime.
- Sets `LABEL com.copy-as-markdown.image=claude-sandbox` so host-side image pruning can be scoped
  to this project (mirrors the e2e harness label convention).
- `ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]`.

### The node_modules native-binary problem

The host `node_modules/` contains **darwin-arm64** native binaries (esbuild, vitest, rollup,
playwright) that cannot run on Linux. Therefore:

- The repo bind-mount must **not** expose the host `node_modules/` to the container.
- A **named volume** overlays `/workspace/node_modules`, shadowing whatever is in the bind-mounted
  tree.
- `entrypoint.sh` runs `npm ci` (Linux-native) into that volume **only when it is empty/stale**;
  the volume persists across runs so this is a one-time cost.
- Playwright browsers come from the base image (`/ms-playwright`, `PLAYWRIGHT_BROWSERS_PATH`
  preset), so no browser download is needed.

### Entrypoint flow (`entrypoint.sh`)

Runs as **root** (required for iptables), in order:

1. `init-firewall.sh` — apply the default-deny egress allowlist.
2. Ensure deps: if `/workspace/node_modules` is empty, run `npm ci` as the non-root user.
3. `exec gosu <non-root-user> "$@"` — drop privileges and run the requested command
   (default: an interactive `bash`; or `claude` when passed).

Running Claude as a **non-root** user is also why `--dangerously-skip-permissions` behaves cleanly.

### Firewall (`init-firewall.sh`)

Default-deny outbound, allow only:

- **DNS** (so hostnames resolve).
- **Anthropic API + Claude auth/login domains** (API calls + the one-time OAuth login flow).
- **npm registry** (for the entrypoint `npm ci` and any in-task installs).
- **GitHub**: `api.github.com`, `github.com`, `codeload.github.com` (gh CLI + git over HTTPS).
- **Loopback / established connections.**

Everything else is dropped. Built with `ipset` from resolved IP ranges, mirroring Anthropic's
reference `init-firewall.sh`. Requires `--cap-add=NET_ADMIN --cap-add=NET_RAW` at `docker run`.

### Host helper (`claude-sandbox.sh`)

- Builds the image on first run (and on Dockerfile changes); tags it `copy-as-markdown-claude-sandbox`.
- `docker run` flags:
  - `--rm -it` — ephemeral container, interactive.
  - `--cap-add=NET_ADMIN --cap-add=NET_RAW` — for the firewall.
  - `--shm-size=1g` — Chromium shared memory **without** sharing the host IPC namespace
    (chosen over the e2e harness's `--ipc=host` to keep the container's IPC isolated).
  - `-v "$ROOT":/workspace` — working tree, read-write (includes `.git`).
  - `-v <node_modules volume>:/workspace/node_modules` — Linux-native deps.
  - `-v <home volume>:/home/<user>/.claude` — persisted Claude login + session state.
- Default command drops into a shell; passing `claude` launches Claude Code directly.

#### Auth volume scoping (login once)

- **Default:** a single shared home volume `claude-sandbox-home`. Log in **once**; the token
  persists and auto-refreshes, and **every** sandbox session — including separate dev tasks —
  reuses it with **no re-login**.
- **Per-task override:** `CLAUDE_SANDBOX_HOME=<name>` selects a dedicated home volume for an
  isolated, parallel sandbox. That volume needs its own one-time login.
- **Caveat:** two sandbox containers sharing the same home volume **simultaneously** also share
  `~/.claude` session/history state and can mildly contend (auth is unaffected). Sequential
  sessions are fine; use a per-task volume for true parallel isolation.

### In-container e2e: reuse `run-playwright.sh` (no new npm script)

No new npm script is added — the package.json script list stays as-is. The in-container e2e path
reuses the **existing** canonical Xvfb wrapper that the e2e harness and CI already use:

```sh
bash docker/playwright-ci/run-playwright.sh
```

Because the working tree is bind-mounted at `/workspace`, this script is present at
`/workspace/docker/playwright-ci/run-playwright.sh`. It is the same script the e2e Docker image
runs as its ENTRYPOINT (`xvfb-run -a --server-args="-screen 0 1280x720x24 -ac +extension RANDR"
npm run test:e2e`), so there is a single source of truth for the Xvfb invocation and the sandbox
gets full CI parity for free. The command is run with `CI=true` so Playwright selects the
non-blocking reporters (and writes `test-results/results.json`) rather than the auto-serving `html`
report that would hang — the e2e Docker image sets this via `ENV`, but the general-purpose sandbox
image does not.

The known clipboard/tab-exporting flake is re-run in isolation in-container, e.g.
`playwright test --project=clipboard-smoke --retries=0`.

Test artifacts (`test-results/`, `playwright-report/`) land in the bind-mounted tree, so they are
readable on the host exactly as today.

## Mounts: least privilege

**Mounted:**

| Source | Target | Mode | Purpose |
|--------|--------|------|---------|
| repo root | `/workspace` | rw | live working tree incl. `.git` |
| named volume | `/workspace/node_modules` | rw | Linux-native deps |
| named volume (`claude-sandbox-home` or per-task) | `~/.claude` | rw | persisted login + session state |

**Deliberately NOT mounted:** `~/.ssh`, `~/.aws`, `~/.npmrc`, host `~/.gitconfig` secrets, shell
history, the macOS Keychain, or any other home-dir path.

## Security properties

- `--dangerously-skip-permissions` runs only inside the container; host filesystem is unreachable
  except the explicit mounts.
- No Docker socket, no Docker-in-Docker: the container cannot control the host daemon.
- Default-deny egress limits data exfiltration to the allowlisted hosts.
- Host Claude credentials (Keychain) are never exposed; the sandbox has its own login.
- Acknowledged residual risk: the working tree (including `.git` history) is read-write and
  reachable by the session — this is the accepted tradeoff for letting Claude edit and commit.

## Testing / verification

- Image builds successfully.
- Inside the container, the full gate passes:
  `npm run typecheck && npm run lint && npm test && npm run build`.
- Inside the container, `bash docker/playwright-ci/run-playwright.sh` runs the Playwright suite (both projects) to
  completion; the clipboard-smoke project uses the container clipboard, not the host's.
- Firewall: an allowlisted host (e.g. the npm registry) is reachable; a non-allowlisted host is
  blocked.
- Auth: after a one-time in-container login, a fresh `docker run` reuses the token with no
  re-login.

## Out of scope

- VS Code devcontainer integration (`.devcontainer/`).
- Fixing the broken Python/pytest Firefox e2e suite (`e2e_test/`).
- Changing the existing `docker/playwright-ci/` harness (the sandbox reuses its base image and
  Xvfb pattern but does not replace it).
