#!/usr/bin/env bash
# post-publish-smoke.sh — Post-publish smoke with bounded retry on npm registry lag.
#
# Immediately after a tag-triggered release, the npm registry can take seconds
# to minutes before a freshly published version is installable, even when
# `npm view` already lists it. The first `npm install -g pi-spine@<version>`
# then fails with ETARGET / "No matching version found" (F9, #247).
#
# Retries are bounded and apply ONLY to lag-class install errors
# (ETARGET / E404 / "No matching version found"). Any other install error
# exits non-zero immediately, and exhausted retries exit non-zero, so real
# missing-version failures are never masked as "registry lag".
#
# Usage: post-publish-smoke.sh <version> [max-attempts] [initial-delay-seconds]

set -euo pipefail

PKG="pi-spine"
MAX_DELAY=60

usage() {
  echo "Usage: $0 <version> [max-attempts] [initial-delay-seconds]" >&2
  exit 2
}

VERSION="${1:-}"
MAX_ATTEMPTS="${2:-6}"
INITIAL_DELAY="${3:-5}"

[ -n "$VERSION" ] || usage
VERSION="${VERSION#v}"  # accept "v2.12.1" or "2.12.1"
[[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] && [ "$MAX_ATTEMPTS" -ge 1 ] || usage
[[ "$INITIAL_DELAY" =~ ^[0-9]+$ ]] && [ "$INITIAL_DELAY" -ge 1 ] || usage

log() { echo "post-publish-smoke: $*"; }

is_lag_error() {
  # Registry-lag class only: version published but not yet installable.
  grep -Eiq 'ETARGET|E404|No matching version found|404 Not Found' "$1"
}

install_log="$(mktemp -t post-publish-smoke)"
trap 'rm -f "$install_log"' EXIT

attempt=1
delay="$INITIAL_DELAY"

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  log "attempt $attempt/$MAX_ATTEMPTS: npm install -g ${PKG}@${VERSION}"
  if npm install -g "${PKG}@${VERSION}" >"$install_log" 2>&1; then
    break
  fi
  if ! is_lag_error "$install_log"; then
    log "FAIL: install error is NOT registry lag (not retried):"
    cat "$install_log" >&2
    exit 1
  fi
  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    log "FAIL: ${PKG}@${VERSION} still not installable after $MAX_ATTEMPTS attempts."
    log "Retry window exhausted — treat as a real missing-version failure (#247),"
    log "not as registry lag. Investigate the publish before retrying manually."
    cat "$install_log" >&2
    exit 1
  fi
  log "registry lag detected (ETARGET/404-class); retrying in ${delay}s"
  sleep "$delay"
  delay=$(( delay * 2 ))
  [ "$delay" -le "$MAX_DELAY" ] || delay="$MAX_DELAY"
  attempt=$(( attempt + 1 ))
done

log "install succeeded; verifying CLI"
installed_version="$(spine version 2>&1 | head -n 1)" || true
echo "$installed_version"
if ! grep -Fq "$VERSION" <<<"$installed_version"; then
  log "FAIL: 'spine version' output does not contain ${VERSION}"
  exit 1
fi

spine doctor
log "OK: ${PKG}@${VERSION} post-publish smoke passed"
