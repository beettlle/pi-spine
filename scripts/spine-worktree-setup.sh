#!/bin/bash
# Spine worktreeSetupHook: runs once per lane (cwd = lane worktree) before the worker starts.
# Opens a stet session at the pre-worker HEAD so the contract can review only the worker's diff,
# and persists the baseline so scripts/spine-stet-contract-run.sh can restore a lost session.
set -euo pipefail

if ! command -v stet >/dev/null 2>&1; then
	echo '{"ok":true,"skipped":"stet not on PATH"}'
	exit 0
fi

baseline="$(git rev-parse HEAD)"
stet start "$baseline" --allow-dirty --quiet >&2
mkdir -p .review
printf '%s\n' "$baseline" > .review/spine-stet-baseline.ref
echo '{"ok":true}'
