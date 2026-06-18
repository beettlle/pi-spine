# Status: SP-244 — startBatch gate before batch.completed

**Task:** SP-244-start-batch-gate-before-complete
**Started:** 2026-06-13
**Completed:** 2026-06-14

## Progress

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Compared `engine.mjs` vs `resume.mjs` gate ordering

### Step 1: Fix ordering

**Status:** ✅ Complete

- [x] `openIntegrateGateAfterBatchComplete` before `transitionPhase(..., "completed")`

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Regression: `startBatch` journals `gate.opened` before `batch.completed`
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 902 pass (2026-06-18)

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-13 | Wave 0 land blocked | Batch 20260614T002359 completed without gate.json |
| 2026-06-14 | Landed | Gate opens before batch.completed journal event |
