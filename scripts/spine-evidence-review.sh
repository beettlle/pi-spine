#!/bin/bash
set -euo pipefail
# Gate evidence review script for stet.
# Usage: scripts/spine-evidence-review.sh [output-path]
#
# Runs stet start/run/finish against the current branch diff and emits the
# JSON review output to stdout. The engine captures stdout when this script is
# used as testing.review and writes it to evidence/review-output.txt.
# If an output-path is provided, the JSON is also tee'd to that path.
#
# Exits non-zero only on a stet hard failure (e.g., binary crash or bad flags).
# Active findings are evidence, not a failure. When stet is not on PATH, the
# script prints a clear skip message and exits 0 so the gate does not fail
# on environments without stet installed.

if ! command -v stet >/dev/null 2>&1; then
	cat <<'EOF'
{"ok":false,"skipped":true,"error":"stet not found on PATH; install from https://github.com/beettlle/stet and ensure it is available to enable gate-level review evidence"}
EOF
	exit 0
fi

out="${1:-/dev/stdout}"

stet start main --allow-dirty --quiet

# Run stet review and capture JSON separately from stderr so we can still
# report warnings without corrupting the JSON output.
tmp_json=$(mktemp)
tmp_err=$(mktemp)
trap 'rm -f "$tmp_json" "$tmp_err"' EXIT

set +e
stet run --json --strictness default > "$tmp_json" 2> "$tmp_err"
run_exit=$?
set -e

# Always attempt to finish the session, even if the run produced findings.
stet finish --quiet 2>/dev/null || true

if [[ "$run_exit" -ne 0 ]]; then
	{
		echo "stet run failed with exit $run_exit" >&2
		if [[ -s "$tmp_err" ]]; then
			echo "stderr:" >&2
			cat "$tmp_err" >&2
		fi
		echo "stdout:" >&2
		cat "$tmp_json" >&2
	}
	exit "$run_exit"
fi

if [[ -s "$tmp_err" ]]; then
	cat "$tmp_err" >&2
fi

tee "$out" < "$tmp_json"
exit 0
