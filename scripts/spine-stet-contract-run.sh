#!/bin/bash
# Spine contract step: review the lane worker's diff with stet and fail only on findings at or above
# the severity/confidence threshold.
# Usage: scripts/spine-stet-contract-run.sh [lenient|default|strict] [task-id]
# Run from the lane worktree root, after scripts/spine-worktree-setup.sh opened the session.
# With task-id (e.g. SP-827), the review is scoped to that task's commits so a second task
# serialized onto the same lane does not re-review the first task's diff.
# SPINE_STET_NO_AUTO_FINISH=1 keeps the session open after a review with no threshold findings.
#
# Gate policy: the contract fails only when `stet list --min-severity --min-confidence` shows
# findings at or above the threshold. Defaults: severity warning, confidence 0.8; override with
# SPINE_STET_MIN_SEVERITY (one of error, warning, info, nitpick; anything else exits 2 before
# touching stet) and SPINE_STET_MIN_CONFIDENCE (0 to 1; validated by `stet list`, whose non-zero
# exit fails the script). Active findings below the threshold are reported to stderr but do not
# block the lane.
# Fallback: an installed stet without the threshold flags (pre-v1.4.0, detected via
# `stet list --help`) gates on ALL active findings after warning on stderr — never silently pass.
set -euo pipefail

strictness="${1:-default}"
task_id="${2:-}"
case "$strictness" in
	lenient|default|strict) ;;
	*)
		echo "stet: invalid strictness '$strictness' (expected lenient, default, or strict)" >&2
		exit 2
		;;
esac

min_severity="${SPINE_STET_MIN_SEVERITY:-warning}"
min_confidence="${SPINE_STET_MIN_CONFIDENCE:-0.8}"
case "$min_severity" in
	error|warning|info|nitpick) ;;
	*)
		echo "stet: invalid SPINE_STET_MIN_SEVERITY '$min_severity' (expected error, warning, info, or nitpick)" >&2
		exit 2
		;;
esac

task_folder=""
if [[ -n "$task_id" ]]; then
	if [[ ! "$task_id" =~ ^[A-Z]+-[0-9]+$ ]]; then
		echo "stet: invalid task id '$task_id' (expected e.g. SP-827)" >&2
		exit 2
	fi
	shopt -s nullglob
	task_dirs=(spine-tasks/"$task_id"-*/)
	shopt -u nullglob
	if [[ "${#task_dirs[@]}" -ne 1 ]]; then
		echo "stet: expected exactly one spine-tasks/${task_id}-*/ folder, found ${#task_dirs[@]}" >&2
		exit 2
	fi
	task_folder="${task_dirs[0]%/}"
fi

baseline_ref=".review/spine-stet-baseline.ref"
if [[ ! -f "$baseline_ref" ]]; then
	# Fallback copy written by the setup hook; survives the engine's `git clean -fdX -- .review`.
	git_dir_ref="$(git rev-parse --git-path spine-stet-baseline.ref 2>/dev/null || true)"
	if [[ -n "$git_dir_ref" && -f "$git_dir_ref" ]]; then
		baseline_ref="$git_dir_ref"
	fi
fi
lane_baseline=""
if [[ -f "$baseline_ref" ]]; then
	lane_baseline="$(tr -d '[:space:]' < "$baseline_ref")"
fi

baseline="$lane_baseline"
if [[ -n "$task_folder" && -n "$lane_baseline" ]]; then
	# Workers commit STATUS.md from Step 0, so the task's first commit touches its folder.
	first_task_commit="$(git rev-list --reverse "${lane_baseline}..HEAD" -- "$task_folder" | sed -n 1p)"
	if [[ -n "$first_task_commit" ]]; then
		baseline="$(git rev-parse "${first_task_commit}^")"
	fi
fi

if [[ -f .review/session.json && -n "$task_folder" && -n "$baseline" ]]; then
	session_baseline="$(stet status | sed -n 's/^baseline: *//p')"
	if [[ "$session_baseline" != "$baseline" ]]; then
		stet finish >/dev/null
	fi
fi

if [[ ! -f .review/session.json ]]; then
	if [[ -z "$baseline" ]]; then
		echo "stet: no session and missing .review/spine-stet-baseline.ref (worktreeSetupHook did not run?)" >&2
		exit 1
	fi
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
# The gating list hides findings below the threshold; the full list is for triage output. An older
# stet without the threshold flags (pre-v1.4.0) falls back to gating on all active findings.
thresholds_supported=1
if ! list_help="$(stet list --help 2>/dev/null)" || ! printf '%s' "$list_help" | grep -q -- '--min-severity'; then
	thresholds_supported=0
	echo "stet: installed stet does not support 'stet list --min-severity'; gating on all active findings" >&2
fi
if [[ "$thresholds_supported" -eq 1 ]]; then
	if ! gating_list="$(stet list --min-severity "$min_severity" --min-confidence "$min_confidence")"; then
		echo "stet: 'stet list' failed; cannot verify active findings" >&2
		exit 1
	fi
else
	gating_list="$active_list"
fi
gating_count="$(printf '%s' "$gating_list" | grep -c . || true)"
active_count="$(printf '%s' "$active_list" | grep -c . || true)"

if [[ "$gating_count" -gt 0 ]]; then
	{
		if [[ "$thresholds_supported" -eq 1 ]]; then
			echo "stet: contract review found ${gating_count} finding(s) at or above the ${min_severity}/${min_confidence} threshold."
		else
			echo "stet: contract review found ${gating_count} active finding(s); this stet cannot filter by threshold, so any active finding blocks."
		fi
		echo "Full list of active findings (all severities, for triage):"
		printf '%s\n' "$active_list"
		echo
	} >&2
	cat >&2 <<EOF
Triage, then re-run the contract:

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

if [[ "$active_count" -gt 0 ]]; then
	echo "stet: ${active_count} finding(s) below the ${min_severity}/${min_confidence} threshold did not block this lane" >&2
fi

if [[ "${SPINE_STET_NO_AUTO_FINISH:-}" == "1" ]]; then
	exit 0
fi

if ! stet finish >/dev/null 2>&1; then
	echo "stet: finish failed after zero-finding review" >&2
	exit 1
fi
exit 0
