#!/usr/bin/env bash
# Collect GitHub issues and spine backlog for release intake.
# Usage: from repo root: skills/spine-release-operator/scripts/collect-release-intake.sh [TARGET_VERSION]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

TARGET="${1:-unknown}"

echo "=== pi-spine release intake snapshot ==="
echo "Target: v${TARGET}"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Repo: $REPO_ROOT"
echo "Branch: $(git branch --show-current 2>/dev/null || echo unknown)"
echo "Package version: $(node -p "require('./package.json').version" 2>/dev/null || echo unknown)"
echo ""

echo "=== GitNexus status ==="
if command -v gitnexus >/dev/null 2>&1; then
  gitnexus status 2>/dev/null || echo "(gitnexus status failed)"
else
  echo "(gitnexus not installed)"
fi
echo ""

echo "=== GitHub open issues (beettlle/pi-spine) ==="
if command -v gh >/dev/null 2>&1; then
  gh issue list --repo beettlle/pi-spine --state open --limit 100 \
    --json number,title,labels,url,createdAt \
    2>/dev/null || echo "(gh failed — check auth)"
else
  echo "(gh not installed)"
fi
echo ""

echo "=== Documentation issues ==="
if command -v gh >/dev/null 2>&1; then
  gh issue list --repo beettlle/pi-spine --state open --label documentation \
    --json number,title,labels \
    2>/dev/null || true
fi
echo ""

echo "=== Bug issues ==="
if command -v gh >/dev/null 2>&1; then
  gh issue list --repo beettlle/pi-spine --state open --label bug \
    --json number,title,labels \
    2>/dev/null || true
fi
echo ""

echo "=== Spine plan pending ==="
if command -v spine >/dev/null 2>&1; then
  spine plan pending 2>/dev/null || true
else
  echo "(spine not installed)"
fi
echo ""

echo "=== Issue → task mapping (Closes:/Partial:) ==="
if command -v rg >/dev/null 2>&1; then
  rg 'Closes:|Partial:' spine-tasks/*/PROMPT.md 2>/dev/null || echo "(no mappings found)"
else
  grep -r 'Closes:\|Partial:' spine-tasks/*/PROMPT.md 2>/dev/null || echo "(no mappings found)"
fi
echo ""

echo "=== Next Task ID (from CONTEXT.md) ==="
grep -E '^\*\*Next Task ID:\*\*' spine-tasks/CONTEXT.md 2>/dev/null || echo "(CONTEXT.md not found)"
