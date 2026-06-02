#!/usr/bin/env bash
# Stub-free dogfood — guided manual validation (SPINE_WORKER_STUB=0, real pi on PATH).
# Exercises Phase 6 manual checklist: preflight → plan → batch → land loop.
#
# Usage:
#   ./scripts/stub-free-dogfood.sh              # preflight + plan + status checks
#   ./scripts/stub-free-dogfood.sh --batch TP-047   # also start detached batch (real pi)
#   ./scripts/stub-free-dogfood.sh --checklist-only # print checklist template only
#
# See docs/compatibility/stub-free-dogfood-report.md for recording results.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SPINE="${SPINE_BIN:-node bin/spine.mjs}"
TASK_ID=""
RUN_BATCH=0
CHECKLIST_ONLY=0

for arg in "$@"; do
	case "$arg" in
		--batch)
			RUN_BATCH=1
			;;
		--checklist-only)
			CHECKLIST_ONLY=1
			;;
		--help|-h)
			sed -n '2,12p' "$0"
			exit 0
			;;
		-*)
			echo "Unknown flag: $arg" >&2
			exit 2
			;;
		*)
			TASK_ID="$arg"
			;;
	esac
done

pass() { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1" >&2; }
warn() { printf '  ⚠️  %s\n' "$1"; }
section() { printf '\n%s\n' "$1"; }

print_checklist() {
	cat <<'EOF'
Manual checklist (record pass/fail in stub-free-dogfood-report.md):

| # | Step | Command |
|---|------|---------|
| 1 | Preflight | spine preflight |
| 2 | Plan | spine plan pending --json |
| 3 | Batch start | SPINE_WORKER_STUB=0 spine batch start <scope> |
| 4 | Status | spine status --diagnose |
| 5 | Gate inspect | spine gate status |
| 6 | Gate approve | spine gate approve |
| 7 | Integrate | spine integrate |
| 8 | Complete | spine batch complete |
| 9 | Dashboard | spine dashboard (or /spine-dashboard) |
EOF
}

if [[ "$CHECKLIST_ONLY" == "1" ]]; then
	print_checklist
	exit 0
fi

section "pi-spine stub-free dogfood"
echo "  repo:   $ROOT"
echo "  commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
echo "  date:   $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

section "Environment checks"

if [[ "${SPINE_WORKER_STUB:-}" == "1" || "${SPINE_WORKER_STUB:-}" == "true" ]]; then
	fail "SPINE_WORKER_STUB is set (${SPINE_WORKER_STUB}) — unset or export SPINE_WORKER_STUB=0"
	exit 1
fi
pass "SPINE_WORKER_STUB unset (real pi workers enabled)"

if ! command -v pi >/dev/null 2>&1; then
	fail "pi not on PATH — install pi and retry"
	exit 1
fi
pass "pi on PATH ($(pi --version 2>&1 | head -1 || echo unknown))"

if [[ ! -f "$ROOT/.spine/spine-config.json" ]]; then
	fail "missing .spine/spine-config.json — run: spine init --preset taskplane-compat"
	exit 1
fi
pass ".spine/spine-config.json present"

PREFLIGHT_OK=1
section "Step 1: spine preflight"
if $SPINE preflight; then
	pass "preflight"
else
	PREFLIGHT_OK=0
	warn "preflight failed (often git-clean during active lane work — re-run from clean project root before batch start)"
	if [[ "$RUN_BATCH" == "1" ]]; then
		fail "batch start requires preflight pass on a clean repo"
		exit 1
	fi
fi

section "Step 2: spine plan pending --json"
if $SPINE plan pending --json >/dev/null; then
	pass "plan pending --json"
else
	fail "plan pending --json"
	exit 1
fi

if [[ -n "$TASK_ID" ]]; then
	section "Step 2b: spine plan $TASK_ID --json"
	$SPINE plan "$TASK_ID" --json | head -20
	pass "plan $TASK_ID"
fi

section "Step 3: spine status --diagnose"
$SPINE status --diagnose
pass "status --diagnose"

section "Step 4: spine gate status"
$SPINE gate status || true

if [[ "$RUN_BATCH" == "1" ]]; then
	if [[ -z "$TASK_ID" ]]; then
		fail "--batch requires a task id (e.g. ./scripts/stub-free-dogfood.sh --batch TP-047)"
		exit 2
	fi
	section "Step 5: SPINE_WORKER_STUB=0 spine batch start $TASK_ID"
	warn "Starting detached batch with real pi workers — monitor with: spine status --diagnose"
	SPINE_WORKER_STUB=0 $SPINE batch start "$TASK_ID"
	pass "batch start dispatched"
	echo ""
	echo "After batch completes, run land loop:"
	echo "  spine gate approve"
	echo "  spine integrate"
	echo "  spine batch complete"
fi

section "Optional: dashboard"
echo "  spine dashboard   # SSE dashboard in background"
echo "  /spine-dashboard  # from pi session"

section "Checklist template"
print_checklist

echo ""
echo "Record results in docs/compatibility/stub-free-dogfood-report.md"
