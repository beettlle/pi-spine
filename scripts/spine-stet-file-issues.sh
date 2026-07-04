#!/bin/bash
# File GitHub issues for active stet findings (contract verify triage).
# Usage: spine-stet-file-issues.sh [SP-XXX]
set -euo pipefail

TASK_ID="${1:-${SPINE_TASK_ID:-unknown}}"
REPO="${SPINE_GITHUB_REPO:-beettlle/pi-spine}"

if ! command -v stet >/dev/null 2>&1; then
	echo "stet not found on PATH" >&2
	exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
	echo "gh not found on PATH" >&2
	exit 1
fi

# Ensure stet label exists (ignore failure if already present).
gh label create stet --color 0e8a16 --description "Stet code review finding" -R "$REPO" 2>/dev/null || true

LIST_OUTPUT="$(stet list 2>/dev/null || true)"
if [[ -z "$LIST_OUTPUT" ]]; then
	echo "No active stet session or no findings to file."
	exit 0
fi

FILED=0
while IFS= read -r line; do
	[[ -z "$line" ]] && continue
	# stet list format: id  file:line  severity  message
	FINDING_ID="$(echo "$line" | awk '{print $1}')"
	REST="$(echo "$line" | cut -d' ' -f2-)"
	FILE_LINE="$(echo "$REST" | awk '{print $1}')"
	SEVERITY="$(echo "$REST" | awk '{print $2}')"
	MESSAGE="$(echo "$REST" | cut -d' ' -f3-)"
	TITLE="[stet] ${MESSAGE:0:80} (${FILE_LINE})"
	gh issue create -R "$REPO" \
		--title "$TITLE" \
		--label "stet" \
		--body "$(cat <<EOF
## Stet finding

- **Task:** ${TASK_ID}
- **Finding ID:** ${FINDING_ID}
- **Location:** \`${FILE_LINE}\`
- **Severity:** ${SEVERITY}
- **Message:** ${MESSAGE}

## Context

Found during spine contract verify (\`stet run\`).
EOF
)"
	FILED=$((FILED + 1))
done <<< "$LIST_OUTPUT"

echo "Filed ${FILED} issue(s) on ${REPO}."
