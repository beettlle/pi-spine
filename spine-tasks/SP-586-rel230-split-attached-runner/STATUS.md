# SP-586: Split attached-runner.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for attached-runner.mjs
- [x] List public exports to preserve

### Step 1: Extract attached-runner-promote.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC (370 LOC)
- [x] Re-export from attached-runner.mjs (shim 304 LOC)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/attached-batch-exit.test.mjs` (4/4 pass; unset SPINE_IS_WORKER for nested-batch fixtures)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (typecheck OK; 1955/1957 pass — 2 pre-existing phase23 failures on `reconcile-diagnosis.mjs` >500, unrelated to this extract)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Explore: `spine-tasks/_explore/batch-module-split-v23/findings.md` — attached-runner.mjs 647 LOC; first half → promote, second half → reconcile (SP-604)
- Do not edit `bin/spine-cli/verify.mjs` (grandfather / SP-593)
- Commit: `refactor(SP-586): extract attached-runner-promote.mjs`

## Discoveries

| Finding | Action |
|---------|--------|
| Public exports preserved via re-export shim | All prior `attached-runner.mjs` exports unchanged for callers |
| Promote/exit → `attached-runner-promote.mjs` | milestones, exit handlers, reporter, engine runner, CLI format/finish, post-merge limbo |
| Leave for SP-604 | lock helpers, `enforceAttachedEngineSingleOwner`, `reconcilePausedResumeDoneInLane` |
| Cycle avoidance | Reconcile exports defined before promote re-export; promote imports reconcile helpers |
| `SPINE_IS_WORKER=1` blocks contract integration fixtures | Re-run contract test with env unset (worker harness artifact) |
| phase23-exit fails on `reconcile-diagnosis.mjs` (1159 LOC) | Pre-existing at parent `eaa9b4b5`; out of File Scope; do not edit verify.mjs |

## Completion Criteria

- [x] First-half extract complete; second half deferred to paired task (SP-604)
