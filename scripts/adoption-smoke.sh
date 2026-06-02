#!/usr/bin/env bash
# Adoption fixture smoke — stub batch in tests/fixtures/adoption-repo copy.
# No network or real pi workers required.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "pi-spine adoption smoke (stub workers)"
echo "  repo: $ROOT"
echo ""

npm run typecheck
SPINE_WORKER_STUB=1 node --test tests/adoption/fixture-batch.test.mjs

echo ""
echo "✅ Adoption smoke passed"
