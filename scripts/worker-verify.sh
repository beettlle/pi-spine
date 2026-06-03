#!/usr/bin/env bash
# Worker verification — typecheck + stub tests without polluting batch journals.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run typecheck
SPINE_WORKER_STUB=1 npm test
