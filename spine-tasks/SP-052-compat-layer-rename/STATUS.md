# SP-052 Status

**Task:** Rename compat/taskplane module
**Status:** ✅ Complete

## Step 1: Move module + update imports
- [x] Move `src/compat/taskplane/` → `src/tasks/packet/`
- [x] Update all importers

## Step 2: Rename tests + PRD wording
- [x] Rename `tests/compat/taskplane-*.test.mjs` → `tests/tasks/packet-*.test.mjs`
- [x] Update PRD module references

## Step 3: Full test suite
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (334/334 pass)
