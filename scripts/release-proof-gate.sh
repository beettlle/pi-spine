#!/usr/bin/env bash
# Release regression gate — prereq checks before release batches (FR-STA-35, FR-REL210-01).
#
# Usage:
#   ./scripts/release-proof-gate.sh
#   RELEASE_GATE_VERSION=2.0.0 ./scripts/release-proof-gate.sh   # v2.0.0 proof manifest only
#   RELEASE_GATE_VERSION=both ./scripts/release-proof-gate.sh     # proof + v2.1.0 manifests
#   SPINE_PROOF_SKIP_GITNEXUS=1 ./scripts/release-proof-gate.sh
#
# Blocking checks: spine doctor, spine preflight, gitnexus up-to-date (unless skipped),
# signoff checklist, release manifest(s), v2.1.0 handoff PRD (when applicable).
# Non-blocking: open P1 bug count (warn only).
#
# Environment overrides (testing / CI):
#   RELEASE_PROOF_GATE_ROOT  Repo root (default: parent of scripts/)
#   RELEASE_GATE_VERSION     2.0.0 | 2.1.0 (default) | both — which manifest checks to run
#   RELEASE_MANIFEST         Explicit manifest path (overrides RELEASE_GATE_VERSION manifest picks)
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

RELEASE_GATE_VERSION="${RELEASE_GATE_VERSION:-2.1.0}"

SIGNOFF_CHECKLIST="$ROOT/docs/release/automation-signoff-checklist.md"
PROOF_MANIFEST="$ROOT/docs/release/manifest-v2.0.0-proof.md"
RELEASE_MANIFEST_V210="$ROOT/docs/release/manifest-v2.1.0.md"
HANDOFF_PRD="$ROOT/docs/PRD-v2.1.0-backlog-drain-handoff.md"

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

check_manifest_file() {
	local label="$1"
	local manifest_path="$2"
	if [[ -f "$manifest_path" ]]; then
		pass "$label present ($manifest_path)"
		record_result "$label" "PASS"
		return 0
	fi
	fail "missing $label: $manifest_path"
	record_result "$label" "FAIL"
	return 1
}

check_release_manifests() {
	section "Check 5: release manifest(s)"
	local manifest_failures=0

	if [[ -n "${RELEASE_MANIFEST:-}" ]]; then
		check_manifest_file "release manifest (RELEASE_MANIFEST)" "$RELEASE_MANIFEST" || manifest_failures=$((manifest_failures + 1))
	elif [[ "$RELEASE_GATE_VERSION" == "2.0.0" ]]; then
		check_manifest_file "proof manifest" "$PROOF_MANIFEST" || manifest_failures=$((manifest_failures + 1))
	elif [[ "$RELEASE_GATE_VERSION" == "2.1.0" ]]; then
		check_manifest_file "v2.1.0 release manifest" "$RELEASE_MANIFEST_V210" || manifest_failures=$((manifest_failures + 1))
	elif [[ "$RELEASE_GATE_VERSION" == "both" ]]; then
		check_manifest_file "proof manifest" "$PROOF_MANIFEST" || manifest_failures=$((manifest_failures + 1))
		check_manifest_file "v2.1.0 release manifest" "$RELEASE_MANIFEST_V210" || manifest_failures=$((manifest_failures + 1))
	else
		fail "invalid RELEASE_GATE_VERSION: $RELEASE_GATE_VERSION (use 2.0.0, 2.1.0, or both)"
		record_result "release manifest(s)" "FAIL"
		return 1
	fi

	if [[ "$manifest_failures" -gt 0 ]]; then
		return 1
	fi
	return 0
}

check_handoff_prd() {
	section "Check 6: v2.1.0 handoff PRD"
	if [[ "$RELEASE_GATE_VERSION" == "2.0.0" ]]; then
		warn "handoff PRD check skipped (RELEASE_GATE_VERSION=2.0.0)"
		record_result "handoff PRD" "SKIP"
		return 0
	fi
	if [[ -f "$HANDOFF_PRD" ]]; then
		pass "handoff PRD present ($HANDOFF_PRD)"
		record_result "handoff PRD" "PASS"
		return 0
	fi
	fail "missing handoff PRD: $HANDOFF_PRD"
	record_result "handoff PRD" "FAIL"
	return 1
}

check_p1_bugs() {
	section "Check 7: open P1 bugs (non-blocking)"
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
	section "Release regression gate"
	echo "  repo:    $ROOT"
	echo "  version: ${RELEASE_GATE_VERSION}${RELEASE_MANIFEST:+ (RELEASE_MANIFEST=$RELEASE_MANIFEST)}"
	echo "  commit:  $(git rev-parse HEAD 2>/dev/null || echo unknown)"
	echo "  date:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"

	local failures=0
	set +e
	check_spine_doctor || failures=$((failures + 1))
	check_spine_preflight || failures=$((failures + 1))
	check_gitnexus || failures=$((failures + 1))
	check_signoff_checklist || failures=$((failures + 1))
	check_release_manifests || failures=$((failures + 1))
	check_handoff_prd || failures=$((failures + 1))
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
