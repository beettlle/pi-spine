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
exec stet run --strictness "$strictness" --auto-finish-zero --quiet
