#!/usr/bin/env bash
# Refresh the self-hosted copy of Hibu's ybDynamicPhoneInsertion.js.
#
# Invoked by /etc/cron.d/wavemax-hibu-refresh every 12 hours. Pulls
# the upstream file from reports.hibu.com (HEAD doesn't reveal a
# meaningful Last-Modified or ETag — Hibu's CDN doesn't honor them
# consistently — so we just fetch the body, compare against the local
# SHA-256, and overwrite only when they differ).
#
# Log: /var/log/wavemax-hibu-refresh.log (one line per run).
# Exit codes:
#   0 — success (no change OR change applied)
#   1 — fetch failed (network / Hibu CDN down)
#   2 — fetch returned empty / suspicious body (sanity check)

set -euo pipefail

UPSTREAM='https://reports.hibu.com/analytics/js/ybDynamicPhoneInsertion.js'
DEST='/var/www/wavemax/wavemax-affiliate-program/public/assets/vendor/ybDynamicPhoneInsertion.js'
TMP="$(mktemp /tmp/hibu-refresh.XXXXXX.js)"
LOG='/var/log/wavemax-hibu-refresh.log'

trap 'rm -f "$TMP"' EXIT

ts() { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { echo "$(ts) $*" >> "$LOG"; }

# Fetch with a 10s connect + 30s overall timeout. -f makes curl exit
# non-zero on HTTP 4xx/5xx (otherwise we'd overwrite the local file
# with an error page).
if ! curl -fsS --connect-timeout 10 --max-time 30 -A 'wavemax-hibu-refresh/1.0' "$UPSTREAM" -o "$TMP"; then
  log "FETCH-FAIL: curl exited non-zero for $UPSTREAM"
  exit 1
fi

# Sanity: file must be non-empty and contain the expected global names
# Hibu's loader sets. If the upstream serves a redirect / error page,
# we don't want to overwrite our working local copy.
if [ ! -s "$TMP" ] || ! grep -q 'ybFindPhNums\|ybFun_ReplaceText' "$TMP"; then
  log "SANITY-FAIL: fetched body missing expected globals (size=$(wc -c < "$TMP") bytes)"
  exit 2
fi

NEW_HASH=$(sha256sum "$TMP" | awk '{print $1}')
OLD_HASH=$(sha256sum "$DEST" 2>/dev/null | awk '{print $1}' || echo 'none')

if [ "$NEW_HASH" = "$OLD_HASH" ]; then
  log "NO-CHANGE: hash=$NEW_HASH"
  exit 0
fi

# Atomic move so concurrent requests never see a half-written file.
install -m 0644 -o root -g root "$TMP" "$DEST"
log "UPDATED: old=$OLD_HASH new=$NEW_HASH size=$(wc -c < "$DEST") bytes"
exit 0
