# Task: SP-244 — startBatch gate before batch.completed

**Created:** 2026-06-13
**Size:** S

## Review Level: 2

**Assessment:** `startBatch` journaled `batch.completed` before `openIntegrateGateAfterBatchComplete`; slow evidence collection left batch in `needs_integrate` with no gate record when engine exited mid-open.

## Mission

Align `startBatch` land-loop ordering with `resume.mjs`: open integrate gate (and persist `gate.json`) before transitioning phase to `completed` and journaling `batch.completed`.

**Incident:** Batch `20260614T002359` (SP-233): phase `completed`, evidence partial, no `gate.json` until manual `openIntegrateGateAfterBatchComplete`.

## File Scope

- `src/batch/engine.mjs`
- `tests/batch/engine-gate-open.test.mjs`

## Steps

### Step 0: Preflight

- [x] Compare `engine.mjs` vs `resume.mjs` gate ordering

### Step 1: Fix ordering

- [x] Call `openIntegrateGateAfterBatchComplete` before `transitionPhase(..., "completed")`

### Step 2: Testing & Verification

- [x] Regression: `startBatch` journals `gate.opened` before `batch.completed`
- [ ] FULL test suite passing

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Detached `batch start` leaves integrate gate on disk when batch completes

---

## Amendments (Added During Execution)
