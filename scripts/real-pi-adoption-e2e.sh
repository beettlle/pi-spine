#!/usr/bin/env bash
# Real-pi adoption E2E — copy adoption fixture, init, batch AD-002.
# Manual/optional only — not part of default npm test.
# Usage: ./scripts/real-pi-adoption-e2e.sh [--batch] [--keep-tmp]
# See docs/adoption/real-pi-e2e.md
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/tests/fixtures/adoption-repo"
SPINE="${SPINE_BIN:-node $ROOT/bin/spine.mjs}"
TASK_ID="AD-002"
RUN_BATCH=0
KEEP_TMP=0
for arg in "$@"; do
  case "$arg" in
    --batch) RUN_BATCH=1 ;;
    --keep-tmp) KEEP_TMP=1 ;;
  esac
done
pass(){ printf '  OK %s\n' "$1"; }
fail(){ printf '  FAIL %s\n' "$1" >&2; exit 1; }
section(){ printf '\n%s\n' "$1"; }
section "real-pi adoption E2E"
[[ "${SPINE_WORKER_STUB:-}" == "1" || "${SPINE_WORKER_STUB:-}" == "true" ]] && fail "SPINE_WORKER_STUB set"
command -v pi >/dev/null || fail "pi missing"
pass "pi $(pi --version 2>&1 | head -1)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/spine-real-pi-adoption-XXXXXX")"
echo "  temp repo: $TMP"
if [[ "$KEEP_TMP" != "1" && "$RUN_BATCH" != "1" ]]; then trap 'rm -rf "$TMP"' EXIT; fi
cp -R "$FIXTURE/." "$TMP/"
cd "$TMP"
git init -q
git config user.email "real-pi@test"
git config user.name "Real Pi"
git add -A && git commit -q -m seed && git branch -M main
if [[ ! -f .spine/spine-config.json ]]; then
  $SPINE init
  git add -A && git commit -q -m init
fi
$SPINE plan "$TASK_ID"
pass "plan $TASK_ID"
[[ "$RUN_BATCH" != "1" ]] && { echo "Run with --batch to execute"; exit 0; }
section "batch start (attached, real pi)"
SPINE_WORKER_STUB=0 $SPINE batch start "$TASK_ID" --skip-preflight --attached
DONE=""
for c in taskplane-tasks/AD-002-real-pi-smoke/.DONE .worktrees/*/lane-1/taskplane-tasks/AD-002-real-pi-smoke/.DONE; do
  [[ -f "$c" ]] && DONE="$c" && break
done
section "evidence"
echo "  temp: $TMP"
echo "  done: ${DONE:-MISSING}"
JOURNAL="$(find .spine/runtime -path '*/journal/events.jsonl' -print 2>/dev/null | head -1)"
[[ -n "$JOURNAL" ]] && tail -5 "$JOURNAL"
[[ -n "$DONE" ]] || fail "no .DONE"
pass "batch complete"
