# SP-052 Status

**Task:** Rename compat/taskplane module
**Status:** 🟨 In Progress

## Step 1: Move module + update imports
- [x] Move `src/compat/taskplane/` → `src/tasks/packet/`
- [x] Update all importers

## Step 2: Rename tests + PRD wording
- [ ] Rename `tests/compat/taskplane-*.test.mjs`
- [ ] Update PRD module references

## Step 3: Full test suite
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
