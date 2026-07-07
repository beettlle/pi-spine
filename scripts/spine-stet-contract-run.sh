#!/bin/bash
set -euo pipefail
# Restore stet session from lane baseline if hook session was lost, then review worker diff.
# Usage: scripts/spine-stet-contract-run.sh [lenient|default|strict]
strictness="${1:-default}"
if [[ ! -f .review/session.json ]]; then
	if [[ ! -f .review/spine-stet-baseline.ref ]]; then
		echo "stet: no session and missing .review/spine-stet-baseline.ref (worktreeSetupHook did not run?)" >&2
		exit 1
	fi
	baseline="$(tr -d '[:space:]' < .review/spine-stet-baseline.ref)"
	stet start "$baseline" --allow-dirty --quiet
fi

# Run without --auto-finish-zero so non-zero findings leave the session open for triage.
set +e
stet run --strictness "$strictness" --quiet
run_exit=$?
set -e

findings_count="$(stet status 2>/dev/null | awk '/^findings:/ { print $2; exit }')"
if [[ -z "$findings_count" || ! "$findings_count" =~ ^[0-9]+$ ]]; then
	echo "stet: could not read findings count from stet status" >&2
	exit 1
fi

if [[ "$findings_count" -gt 0 ]]; then
	cat >&2 <<EOF
stet: contract verify found ${findings_count} active finding(s). Triage before re-running contract:

  stet list
  stet dismiss <id> <reason>

Dismiss reasons: false_positive, already_correct, wrong_suggestion, out_of_scope.
See docs/adoption/operator-runbook.md §8.1 and .cursor/rules/stet-integration.mdc.
Project code defects → file issues on beettlle/pi-spine (label stet). Do not dismiss without fix + issue or documented reason.

Session left open for triage (history.jsonl accumulates on dismiss).
EOF
	exit 1
fi

if [[ "${SPINE_STET_NO_AUTO_FINISH:-}" == "1" ]]; then
	[[ "$run_exit" -ne 0 ]] && exit "$run_exit"
	exit 0
fi

# Zero findings: auto-finish (same outcome as former --auto-finish-zero on stet run).
if ! stet finish >/dev/null 2>&1; then
	echo "stet: finish failed after zero-finding review" >&2
	exit 1
fi

[[ "$run_exit" -ne 0 ]] && exit "$run_exit"
exit 0
