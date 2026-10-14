#!/bin/bash
# Spine contract step: review the lane worker's diff with stet and fail while active findings remain.
# Usage: scripts/spine-stet-contract-run.sh [lenient|default|strict] [task-id]
# Run from the lane worktree root, after scripts/spine-worktree-setup.sh opened the session.
# With task-id (e.g. SP-827), the review is scoped to that task's commits so a second task
# serialized onto the same lane does not re-review the first task's diff.
# SPINE_STET_NO_AUTO_FINISH=1 keeps the session open after a zero-finding review.
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
