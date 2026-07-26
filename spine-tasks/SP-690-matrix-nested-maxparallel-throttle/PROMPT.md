# Task: SP-690 — Cap nested matrix concurrency to remaining slots

**Created:** 2026-07-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Interim throttle so nested `runConcurrent` does not reuse full `maxParallel` while the parent lane is held; depends on SP-688 landing first (shared matrix files).
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #227 — Enforce the interim invariant that global in-flight workers (non-matrix lane workers + matrix rows) do not exceed `lanes.maxParallel`. Today `runMatrixTaskOnLane` passes `config.lanes.maxParallel` into nested `runConcurrent` while the parent already holds a lane. Throttle nested matrix concurrency to **remaining** free slots (minimum 1). Document interim behavior in the operator runbook until first-class row scheduling (#228) supersedes it.

**Hard requirement:** Engine production path must apply the throttle — not a pure helper unused by `runMatrixTaskOnLane`.

## Dependencies

- **Task:** SP-688 (matrix worktree setup — shared `matrix-run.mjs` / matrix engine path; serialize to avoid merge thrash)

## Context to Read First

- `src/batch/engine-lanes.mjs` — passes `maxParallel: config.lanes.maxParallel` into matrix (~L161)
- `src/batch/engine-lanes/matrix-run.mjs` — `runMatrixTaskOnLane` → `runConcurrent`
- `src/batch/engine-lanes/matrix.mjs` — `runConcurrent`
- `tests/batch/matrix-execution.test.mjs`
- `docs/adoption/operator-runbook.md`
- GitHub #227
- Parent split context: after SP-688 hook wiring

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/matrix-execution.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `spine-tasks/SP-690-matrix-nested-maxparallel-throttle/STATUS.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm nested `runConcurrent` uses full `maxParallel` while parent lane is held
- [ ] Confirm SP-688 is `.DONE` / integrated before implementing (dependency)

### Step 1: Throttle nested matrix concurrency

- [ ] Compute remaining slots when parent holds a lane (interim: at least `max(1, maxParallel - occupiedLaneSlots)` or equivalent documented formula)
- [ ] Pass throttled limit into `runConcurrent` from production `runMatrixTaskOnLane` / caller
- [ ] Preserve fail-closed row failure behavior; do not weaken matrix abort semantics

### Step 2: Testing & Verification

- [ ] Regression: mixed wave (matrix + sibling) cannot exceed `lanes.maxParallel` in-flight workers (or assert nested limit ≤ remaining slots under fixture)
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Document interim global in-flight ≤ `maxParallel` invariant and that #228 may supersede the throttle
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — matrix concurrency interim invariant

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] Nested matrix concurrency uses remaining slots, not full `maxParallel` while parent holds a lane
- [ ] Regression covers mixed / overshoot case
- [ ] Runbook documents interim vs future first-class scheduling

## Do NOT

- Implement first-class matrix row lane scheduling (#228)
- Silently auto-downgrade unrelated lane packing
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-690): throttle nested matrix concurrency to remaining slots (#227)`

## Amendments

- **2026-07-25 (pre-landed shared scope):** SP-688 changed the shared matrix execution tests and implementation paths before this dependent task started. Redirected `fileScopeMustChange` to `STATUS.md` so contract verification measures SP-690 delivery rather than SP-688's landed diff. SP-690 must still wire the throttle into the production matrix path, add the overshoot regression, and update the runbook as required above.
