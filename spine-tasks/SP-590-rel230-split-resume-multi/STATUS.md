# SP-590: Split resume-multi-lanes.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for resume-multi-lanes.mjs
- [x] Confirm dependencies satisfied
- [x] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)
**Status:** ✅ Complete

- [x] Create `src/batch/resume-multi-queue.mjs`
- [x] Move implementations per handoff: per-lane queue wiring → resume-multi-queue.mjs
- [x] Keep each new file ≤500 LOC

### Step 2: Re-export
**Status:** ✅ Complete

- [x] Remove moved code from `src/batch/resume-multi-lanes.mjs`
- [x] Re-export public symbols from new module(s)
- [x] Remove `src/batch/resume-multi-lanes.mjs` from `PHASE23_GRANDFATHERED_OVER_500`

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Pending

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Pending

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Real-pi worker: plan/code/final review deferred to engine after `.DONE` (SP-195/SP-278)
- GitNexus impact on `executeResumeWave` / `resetFailedTasksForForceResume`: LOW (caller: `resumeMultiTaskBatch`)

## Plan (Review Level 1)

1. Extract `executeResumeWave` (per-lane queue wiring) → `resume-multi-queue.mjs`.
2. Export private helpers `markTaskCompleteFromDisk` / `runResumedTaskOnLane` from lanes for queue import (same cycle pattern as attached-runner ↔ promote).
3. Re-export `executeResumeWave` from `resume-multi-lanes.mjs`; keep `resetFailedTasksForForceResume` in lanes.
4. Remove grandfather entry; both files ≤500 LOC.

## Discoveries

| Finding | Action |
|---------|--------|
| File is 583 LOC; public exports: `executeResumeWave`, `resetFailedTasksForForceResume` | Preserve via re-export |
| Handoff: per-lane queue wiring → resume-multi-queue.mjs | Move `executeResumeWave` only |
| SP-588 STATUS not started / no `.DONE`; scopes disjoint (engine vs resume-multi) | Proceed — engine assigned this lane |
| attached-runner ↔ promote already uses parent↔extract import cycle | Reuse that pattern |
| After split: lanes 441 LOC, queue 159 LOC | Both ≤500; grandfather entry removed |
