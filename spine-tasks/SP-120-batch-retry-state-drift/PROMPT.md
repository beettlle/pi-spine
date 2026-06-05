# Task: SP-120 — Batch retry clears stale failed task state

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Batch 20260605T191325 stress test: SP-118 completed on retry (journal task.completed) but batch-state kept status=failed until third retry; blocked wave merge.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

When `spine batch retry <taskId>` succeeds and worker emits `task.completed`, ensure batch-state task row, segment, failedTasks count, and reconcile diagnosis reflect success — not the prior `prompt_parse_failed` classification.

**Source:** Batch `20260605T191325` operator recovery.

## Dependencies

- **None**

## File Scope

- `src/batch/retry.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/state.mjs`
- `tests/batch/retry-state-drift.test.mjs` (new)
- `tests/fixtures/incidents/retry-clears-failed-classification.json` (new)

## Steps

### Step 1: Reproduce + fix state transition
- [ ] Fixture: task.failed then retry then task.completed → task.status succeeded, failedTasks decremented
- [ ] Clear exitReason/classification on retry reset

### Step 2: Testing & Verification
- [ ] FULL suite + coverage gate

### Step 3: Documentation & Delivery
- [ ] Incident note in `docs/incidents/` referencing batch 20260605T191325
- [ ] `.DONE`

## Completion Criteria
- [ ] Retry success removes stale failed classification from reconcile output

## Git Commit Convention
- `fix(SP-120): clear failed task state on successful retry`

## Do NOT
- Change retry semantics for segment drift unrelated to classification

---

## Amendments (Added During Execution)
