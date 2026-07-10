# SP-592: Monitor resume and lifecycle LOC — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Run `wc -l src/batch/resume.mjs src/batch/lifecycle.mjs` → resume 506, lifecycle 498
- [x] Confirm SP-590 complete (`.DONE` present)

### Step 1: Verify or split
**Status:** 🔄 In Progress

- [x] lifecycle.mjs ≤500 → removed from `PHASE23_GRANDFATHERED_OVER_500` only (no split)
- [x] resume.mjs >500 → extracted `validateResumeBatch` to `resume-single-validate.mjs`; re-export from `resume.mjs`; removed grandfather entry

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `node --test tests/batch/resume-orphan-recovery.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Record LOC outcome in STATUS.md
- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Plan review at Step 1: skipped (real-pi worker; engine reviews after `.DONE`)
- Blast radius for `validateResumeBatch`: LOW (callers keep importing from `resume.mjs` re-export)

## Discoveries

| Finding | Action |
|---------|--------|
| resume.mjs still 506 after prior waves | Extracted `validateResumeBatch` → `resume-single-validate.mjs` |
| lifecycle.mjs 498 ≤500 | Removed grandfather only; did not split |

## LOC outcome (pending final wc after Step 1 commit)

| File | Before | After |
|------|--------|-------|
| `src/batch/resume.mjs` | 506 | (verify) |
| `src/batch/lifecycle.mjs` | 498 | 498 (unchanged) |
| `src/batch/resume-single-validate.mjs` | — | new |
