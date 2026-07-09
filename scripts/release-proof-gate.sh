#!/usr/bin/env bash
# Release proof regression gate — prereq checks before v2.0.0 proof batch (FR-STA-35).
#
# Usage:
#   ./scripts/release-proof-gate.sh
#   SPINE_PROOF_SKIP_GITNEXUS=1 ./scripts/release-proof-gate.sh
#
# Blocking checks: spine doctor, spine preflight, gitnexus up-to-date (unless skipped),
# signoff checklist + proof manifest on disk.
# Non-blocking: open P1 bug count (warn only).
#
# Environment overrides (testing / CI):
#   RELEASE_PROOF_GATE_ROOT  Repo root (default: parent of scripts/)
#   SPINE_BIN                spine CLI (default: spine, else node bin/spine.mjs)
#   GITNEXUS_BIN             gitnexus CLI (default: gitnexus)
#   GH_REPO                  GitHub repo for P1 query (default: beettlle/pi-spine)
#   SPINE_PROOF_SKIP_GITNEXUS=1  Bypass stale gitnexus index failure
#
# Exit codes:
#   0 — all blocking checks passed
#   1 — one or more blocking checks failed
#   2 — configuration error (missing repo root)
set -euo pipefail

ROOT="${RELEASE_PROOF_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

if [[ ! -d "$ROOT/.spine" ]]; then
	echo "release-proof-gate: not a pi-spine repo root: $ROOT" >&2
	exit 2
fi

SPINE="${SPINE_BIN:-}"
if [[ -z "$SPINE" ]]; then
	if command -v spine >/dev/null 2>&1; then
		SPINE="spine"
	else
		SPINE="node bin/spine.mjs"
	fi
fi

GITNEXUS="${GITNEXUS_BIN:-gitnexus}"
GH_REPO="${GH_REPO:-beettlle/pi-spine}"

SIGNOFF_CHECKLIST="$ROOT/docs/release/automation-signoff-checklist.md"
PROOF_MANIFEST="$ROOT/docs/release/manifest-v2.0.0-proof.md"

pass() { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1" >&2; }
warn() { printf '  ⚠️  %s\n' "$1"; }
section() { printf '\n%s\n' "$1"; }

declare -a SUMMARY_NAMES=()
declare -a SUMMARY_RESULTS=()

record_result() {
	local name="$1"
	local result="$2"
	SUMMARY_NAMES+=("$name")
	SUMMARY_RESULTS+=("$result")
}

check_spine_doctor() {
	section "Check 1: spine doctor"
	if $SPINE doctor >/dev/null 2>&1; then
		pass "spine doctor"
		record_result "spine doctor" "PASS"
		return 0
	fi
	fail "spine doctor failed"
	record_result "spine doctor" "FAIL"
	return 1
}

check_spine_preflight() {
	section "Check 2: spine preflight"
	if $SPINE preflight >/dev/null 2>&1; then
		pass "spine preflight"
		record_result "spine preflight" "PASS"
		return 0
	fi
	fail "spine preflight failed (need clean git and no active batch)"
	record_result "spine preflight" "FAIL"
	return 1
}

check_gitnexus() {
	section "Check 3: gitnexus status"
	if [[ "${SPINE_PROOF_SKIP_GITNEXUS:-}" == "1" ]]; then
		warn "gitnexus check bypassed (SPINE_PROOF_SKIP_GITNEXUS=1)"
		record_result "gitnexus status" "SKIP"
		return 0
	fi
	if ! command -v "$GITNEXUS" >/dev/null 2>&1; then
		fail "gitnexus not on PATH"
		record_result "gitnexus status" "FAIL"
		return 1
	fi
	local status_output=""
	set +e
	status_output="$("$GITNEXUS" status 2>&1)"
	local status_exit=$?
	set -e
	if [[ "$status_exit" -ne 0 ]]; then
		fail "gitnexus status command failed"
		printf '%s\n' "$status_output" >&2
		record_result "gitnexus status" "FAIL"
		return 1
	fi
	if printf '%s\n' "$status_output" | grep -Eq 'Status:.*up-to-date'; then
		pass "gitnexus status up-to-date"
		record_result "gitnexus status" "PASS"
		return 0
	fi
	fail "gitnexus index stale (re-run: gitnexus analyze)"
	printf '%s\n' "$status_output" >&2
	warn "Bypass with SPINE_PROOF_SKIP_GITNEXUS=1 if intentional"
	record_result "gitnexus status" "FAIL"
	return 1
}

check_signoff_checklist() {
	section "Check 4: automation signoff checklist"
	if [[ -f "$SIGNOFF_CHECKLIST" ]]; then
		pass "signoff checklist present ($SIGNOFF_CHECKLIST)"
		record_result "signoff checklist" "PASS"
		return 0
	fi
	fail "missing signoff checklist: $SIGNOFF_CHECKLIST"
	record_result "signoff checklist" "FAIL"
	return 1
}

check_proof_manifest() {
	section "Check 5: proof manifest"
	if [[ -f "$PROOF_MANIFEST" ]]; then
		pass "proof manifest present ($PROOF_MANIFEST)"
		record_result "proof manifest" "PASS"
		return 0
	fi
	fail "missing proof manifest: $PROOF_MANIFEST"
	record_result "proof manifest" "FAIL"
	return 1
}

check_p1_bugs() {
	section "Check 6: open P1 bugs (non-blocking)"
	if ! command -v gh >/dev/null 2>&1; then
		warn "gh not installed — skipping P1 bug count"
		record_result "open P1 bugs" "WARN (skipped)"
		return 0
	fi
	local count=""
	set +e
	count="$(gh issue list --repo "$GH_REPO" --state open --label "priority:P1" --json number -q 'length' 2>/dev/null)"
	local gh_exit=$?
	set -e
	if [[ "$gh_exit" -ne 0 || -z "$count" || ! "$count" =~ ^[0-9]+$ ]]; then
		warn "could not query P1 issues — skipping"
		record_result "open P1 bugs" "WARN (query failed)"
		return 0
	fi
	if [[ "$count" -eq 0 ]]; then
		pass "open P1 bugs: 0"
		record_result "open P1 bugs" "PASS"
	else
		warn "open P1 bugs: $count (non-blocking — resolve before publish)"
		record_result "open P1 bugs" "WARN ($count open)"
	fi
	return 0
}

print_summary() {
	section "Summary"
	local i
	for i in "${!SUMMARY_NAMES[@]}"; do
		printf '  %-24s %s\n' "${SUMMARY_NAMES[$i]}" "${SUMMARY_RESULTS[$i]}"
	done
}

main() {
	section "Release proof regression gate"
	echo "  repo:   $ROOT"
	echo "  commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
	echo "  date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"

	local failures=0
	set +e
	check_spine_doctor || failures=$((failures + 1))
	check_spine_preflight || failures=$((failures + 1))
	check_gitnexus || failures=$((failures + 1))
	check_signoff_checklist || failures=$((failures + 1))
	check_proof_manifest || failures=$((failures + 1))
	check_p1_bugs
	set -e

	print_summary
	echo ""
	if [[ "$failures" -eq 0 ]]; then
		pass "All blocking checks passed"
		exit 0
	fi
	fail "$failures blocking check(s) failed"
	exit 1
}

main "$@"
