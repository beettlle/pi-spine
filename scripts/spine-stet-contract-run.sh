#!/bin/bash
# Spine contract step: review the lane worker's diff with stet and fail while active findings remain.
# Usage: scripts/spine-stet-contract-run.sh [lenient|default|strict]
# Run from the lane worktree root, after scripts/spine-worktree-setup.sh opened the session.
# SPINE_STET_NO_AUTO_FINISH=1 keeps the session open after a zero-finding review.
set -euo pipefail

strictness="${1:-default}"
case "$strictness" in
	lenient|default|strict) ;;
	*)
		echo "stet: invalid strictness '$strictness' (expected lenient, default, or strict)" >&2
		exit 2
		;;
esac

if [[ ! -f .review/session.json ]]; then
	if [[ ! -f .review/spine-stet-baseline.ref ]]; then
		echo "stet: no session and missing .review/spine-stet-baseline.ref (worktreeSetupHook did not run?)" >&2
		exit 1
	fi
	baseline="$(tr -d '[:space:]' < .review/spine-stet-baseline.ref)"
	stet start "$baseline" --allow-dirty --quiet
fi

# No --auto-finish-zero: a non-zero finding count must leave the session open for triage.
set +e
stet run --strictness "$strictness" --quiet
run_exit=$?
set -e
if [[ "$run_exit" -ne 0 ]]; then
	echo "stet: run failed (exit $run_exit); check 'stet doctor' and that LM Studio / OpenJev are up" >&2
	exit "$run_exit"
fi

# stet list prints one line per active (non-dismissed) finding; stet status counts dismissed ones too.
if ! active_list="$(stet list)"; then
	echo "stet: 'stet list' failed; cannot verify active findings" >&2
	exit 1
fi
active_count="$(printf '%s' "$active_list" | grep -c . || true)"
if [[ "$active_count" -gt 0 ]]; then
	cat >&2 <<EOF
stet: contract review found ${active_count} active finding(s). Triage, then re-run the contract:

  stet list
  stet dismiss <id> <reason>

Dismiss reasons: false_positive, already_correct, wrong_suggestion, out_of_scope.
Fix real defects in this task's diff. If a finding exposes a stet reviewer bug (bad prompt,
parser, critic), dismiss it with a reason and record it under Discoveries in STATUS.md.
Never dismiss a real defect without fixing it.
Project code defects → file issues on beettlle/pi-spine (label stet); stet reviewer bugs →
https://github.com/beettlle/stet/issues.
See docs/adoption/operator-runbook.md §8.1.
EOF
	exit 1
fi

if [[ "${SPINE_STET_NO_AUTO_FINISH:-}" == "1" ]]; then
	exit 0
fi

if ! stet finish >/dev/null 2>&1; then
	echo "stet: finish failed after zero-finding review" >&2
	exit 1
fi
exit 0
