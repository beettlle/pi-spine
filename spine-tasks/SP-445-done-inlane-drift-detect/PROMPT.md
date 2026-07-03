# Task: SP-445 — doneInLane drift detection

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Reconcile/journal correctness; extends SP-175 drift detection for #100 gap.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extend `detectBatchStateDrift()` so cache `status` of `running` or `pending` is flagged when reconcile sees `doneInLane: true` or `classification: terminal-success` without a matching journal terminal lifecycle event. Enables `state_drift` diagnosis and operator recovery. Part of [#100](https://github.com/beettlle/pi-spine/issues/100) fix (bullet 1 of 4).

## Dependencies

- **None**

## Context to Read First

- GitHub issue [#100](https://github.com/beettlle/pi-spine/issues/100) (comment on batch `20260702T153101`)
- `spine-tasks/SP-175-rel-reconcile-drift` (baseline `detectBatchStateDrift`)
- `src/batch/reconcile.mjs` — `classifyTaskDoneSemantics`, `doneInLane`
- `src/batch/journal-rebuild.mjs` — `detectBatchStateDrift`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal-rebuild.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/journal-rebuild-drift.test.mjs`
- `tests/batch/diagnosis-failure-class.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/journal-rebuild-drift.test.mjs tests/batch/diagnosis-failure-class.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #100 acceptance criteria (doneInLane vs cache status gap)
- [ ] Read SP-175 implementation and existing drift tests

### Step 1: Drift detection

- [ ] Add drift rule: cached `running`/`pending` + reconcile `doneInLane` or `terminal-success` without journal `task.completed`/`task.skipped`/`task.failed` terminal
- [ ] Return structured drift entry (`field: doneInLane`, `cached`, `rebuilt`)
- [ ] Fixture from batch `20260702T153101` (SP-434/439 `running` + `doneInLane: true`)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook `state_drift` row if diagnosis headline changes
- [ ] Update `spine-tasks/CONTEXT.md` — SP-445 status
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — `state_drift` / doneInLane drift (if new operator surface)

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Drift fixture passes for doneInLane mismatch
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-445): complete Step N — description`
- `fix(SP-445): description`

## Do NOT

- Close issue #100 in this task (SP-447 closes after dashboard/diagnosis land)
- Expand scope into dashboard or resume handoff (SP-446–SP-448)
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
