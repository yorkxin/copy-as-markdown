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
