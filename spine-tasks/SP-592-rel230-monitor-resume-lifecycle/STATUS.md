# SP-592: Monitor resume and lifecycle LOC — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Run `wc -l src/batch/resume.mjs src/batch/lifecycle.mjs` → resume 506, lifecycle 498
- [x] Confirm SP-590 complete (`.DONE` present)

### Step 1: Verify or split
**Status:** ✅ Complete

- [x] lifecycle.mjs ≤500 → removed from `PHASE23_GRANDFATHERED_OVER_500` only (no split)
- [x] resume.mjs >500 → extracted `validateResumeBatch` to `resume-single-validate.mjs`; re-export from `resume.mjs`; removed grandfather entry

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/resume-orphan-recovery.test.mjs` — 6/6 pass
- [x] `npm run typecheck && env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test` — typecheck pass; 1955/1957 pass (2 pre-existing `reconcile-diagnosis.mjs` >500 fails — out of scope, same as SP-589)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Record LOC outcome in STATUS.md
- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Plan review at Step 1: skipped (real-pi worker; engine reviews after `.DONE`)
- Blast radius for `validateResumeBatch`: LOW (callers keep importing from `resume.mjs` re-export)
- Full suite must unset `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` or nested batch tests fail closed

## Discoveries

| Finding | Action |
|---------|--------|
| resume.mjs still 506 after prior waves | Extracted `validateResumeBatch` → `resume-single-validate.mjs` |
| lifecycle.mjs 498 ≤500 | Removed grandfather only; did not split |
| `SPINE_IS_WORKER=1` blocks batch-start tests | Re-run full suite with env unset (worker harness artifact) |
| `reconcile-diagnosis.mjs` 1159 LOC fails phase23-exit | Pre-existing from SP-578/SP-596; out of scope |

## LOC outcome

| File | Before | After |
|------|--------|-------|
| `src/batch/resume.mjs` | 506 | 489 |
| `src/batch/lifecycle.mjs` | 498 | 498 (unchanged) |
| `src/batch/resume-single-validate.mjs` | — | 25 |
| Grandfather entries | both listed | both removed |
