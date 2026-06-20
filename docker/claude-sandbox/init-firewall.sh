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
