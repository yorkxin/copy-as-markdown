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

# Match the in-container user to the host user so the bind-mounted working tree stays writable.
# On native Linux, bind mounts pass through real uid/gid with NO mapping, so this is REQUIRED;
# on macOS Docker Desktop ownership is auto-mapped and passing these is a harmless no-op.
host_uid="$(id -u)"
host_gid="$(id -g)"

# SELinux hosts (RHEL/Fedora/Rocky) deny container access to bind mounts unless the mount is
# relabeled with `:z`. Only add it when SELinux is actually present (no-op/absent elsewhere).
workspace_mount="$ROOT:/workspace"
[ -d /sys/fs/selinux ] && workspace_mount="$workspace_mount:z"

# Allocate an interactive TTY only when we actually have one (so a piped/non-interactive
# `claude-sandbox.sh some-command` still works instead of erroring "input device is not a TTY").
# The `[@]+...` guard keeps the empty-array expansion safe under `set -u` on bash 3.2 (macOS).
tty_flags=()
[ -t 0 ] && [ -t 1 ] && tty_flags=(-it)

docker run --rm ${tty_flags[@]+"${tty_flags[@]}"} \
  --cap-add=NET_ADMIN --cap-add=NET_RAW \
  --shm-size=1g \
  -e SANDBOX_UID="$host_uid" -e SANDBOX_GID="$host_gid" \
  -v "$workspace_mount" \
  -v "$NODE_MODULES_VOLUME":/workspace/node_modules \
  -v "$HOME_VOLUME":/home/pwuser/.claude \
  "$IMAGE" "$@"
code=$?

# Prune dangling images orphaned by this project's previous sandbox builds (label-scoped).
docker image prune -f --filter "label=$LABEL" >/dev/null 2>&1 || true

exit "$code"
