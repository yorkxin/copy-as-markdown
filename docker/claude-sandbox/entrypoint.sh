#!/bin/bash
# Entrypoint runs as root (required for iptables). It applies the firewall, prepares the
# mounted volumes, installs Linux-native node_modules on first run / lockfile change, then drops
# to a non-root user to run the requested command (default: bash).
#
# Cross-platform uid/gid: the launcher passes SANDBOX_UID/SANDBOX_GID = the HOST user's uid/gid.
# On native Linux, bind mounts pass through real uid/gid with no mapping, so the dropped user must
# match the host owner or it cannot write to /workspace. On macOS Docker Desktop ownership is
# auto-mapped, so this is harmless there. Defaults to 1001 (the base image's pwuser) when unset.
#
# Privilege drop uses `setpriv` (from util-linux, already in the Playwright base image — zero
# added dependency). Like gosu, it does a clean exec-based drop, so signals and exit codes pass
# straight through to the child.
#
# setpriv changes ONLY process credentials, not the environment — so we must set HOME/USER for
# the dropped child via `env`. Without it HOME stays /root: npm hits EACCES on /root/.npm, and
# Claude Code would look for ~/.claude in /root instead of the mounted home volume.
set -euo pipefail

SANDBOX_UID="${SANDBOX_UID:-1001}"
SANDBOX_GID="${SANDBOX_GID:-1001}"
SANDBOX_HOME=/home/pwuser

# Ensure the target uid maps to a named user. A host uid with no /etc/passwd entry (macOS 501,
# or a Linux uid not baked into the image) makes whoami, git, and Node's os.userInfo() fail —
# the last can crash Claude Code. If the uid already resolves (e.g. the default 1001 = pwuser),
# reuse that name; otherwise create one so --init-groups and passwd lookups work.
sandbox_name="$(getent passwd "$SANDBOX_UID" 2>/dev/null | cut -d: -f1 || true)"
if [ -z "$sandbox_name" ]; then
  getent group "$SANDBOX_GID" >/dev/null 2>&1 || groupadd -o -g "$SANDBOX_GID" ccsandbox
  useradd -o -u "$SANDBOX_UID" -g "$SANDBOX_GID" -d "$SANDBOX_HOME" -M -s /bin/bash ccsandbox
  sandbox_name=ccsandbox
fi

# The command prefix that drops root → the host-matched user with a correct environment.
drop=(setpriv --reuid="$SANDBOX_UID" --regid="$SANDBOX_GID" --init-groups
      env "HOME=$SANDBOX_HOME" "USER=$sandbox_name" "LOGNAME=$sandbox_name")

# chown -R only when ownership doesn't already match (avoids paying the recursive cost every
# start, and re-homes a volume first created under a different uid — e.g. moved between hosts).
fix_owner() {
  local target="$1"
  [ -e "$target" ] || return 0
  if [ "$(stat -c '%u' "$target" 2>/dev/null)" != "$SANDBOX_UID" ]; then
    chown -R "$SANDBOX_UID:$SANDBOX_GID" "$target"
  fi
}

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

# 2. Make the mounted volumes owned by the dropped user.
mkdir -p "$SANDBOX_HOME/.claude" /workspace/node_modules
chown "$SANDBOX_UID:$SANDBOX_GID" "$SANDBOX_HOME" 2>/dev/null || true
fix_owner "$SANDBOX_HOME/.claude"
fix_owner /workspace/node_modules

# 3. Install dependencies into the node_modules volume when the lockfile hash changes.
if [ -f /workspace/package-lock.json ]; then
  lock_hash="$(sha256sum /workspace/package-lock.json | cut -d' ' -f1)"
  stamp=/workspace/node_modules/.lock-hash
  if [ ! -f "$stamp" ] || [ "$(cat "$stamp" 2>/dev/null)" != "$lock_hash" ]; then
    echo "[sandbox] installing dependencies (npm ci)..."
    "${drop[@]}" bash -lc 'cd /workspace && npm ci'
    echo "$lock_hash" | "${drop[@]}" tee "$stamp" >/dev/null
  else
    echo "[sandbox] dependencies up to date"
  fi
fi

# 4. Drop privileges and run the requested command.
exec "${drop[@]}" "$@"
