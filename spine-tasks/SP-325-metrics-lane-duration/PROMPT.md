# Task: SP-325 — Task metrics laneNumber and durationMs

**Created:** 2026-06-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend run-metrics task records with laneNumber and durationMs; backward compatible schemaVersion 1.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Enrich task run-metrics records with laneNumber and durationMs.

Update buildTaskMetricRecord in src/batch/metrics.mjs and call sites in src/batch/engine-lanes/queue.mjs.

Fields are optional and backward compatible (schemaVersion 1).

## Dependencies

-1. **None**

## Context to Read First

- `src/batch/metrics.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `bin/spine.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/metrics.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `tests/batch/metrics*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/metrics` |
| fileScopeMustChange | `src/batch/metrics.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Review current task metric record shape
- [ ] Identify laneNumber source at metric write time

### Step 1: Add laneNumber and durationMs to task metrics

- [ ] Extend buildTaskMetricRecord with optional laneNumber, durationMs
- [ ] Pass laneNumber from engine-lanes call sites
- [ ] Compute durationMs from startedAt/endedAt

### Step 2: Testing & Verification

- [ ] Extend metrics tests for new fields
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Note new run-metrics fields in operator-runbook
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Task metrics include laneNumber and durationMs when available
- [ ] Backward compatible
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-325): complete Step N — description`
- `fix(SP-325): description`
- `test(SP-325): description`

## Do NOT

- Bump schemaVersion without migration note
- Add token/tps fields (out of scope)

---

## Amendments (Added During Execution)
