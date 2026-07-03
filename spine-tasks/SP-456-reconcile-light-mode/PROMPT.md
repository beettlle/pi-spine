# Task: SP-456 — Reconcile batch light mode

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** reconcileBatch light path; hub module touch.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add `reconcileBatch({ light: true })` to skip verbose git branch scans when batch phase unchanged since last reconcile ([#98](https://github.com/beettlle/pi-spine/issues/98) P1).
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98) (partial)

## Dependencies

- **Task:** SP-452 (sequence/attached use light reconcile where safe)

## Context to Read First

- GitHub issue #98 P1
- `src/batch/reconcile.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/sequence.mjs`
- `tests/batch/reconcile-light.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/reconcile-light.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/reconcile.mjs` |
| artifactsMustExist | `tests/batch/reconcile-light.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Light mode

- [ ] Define safe skip conditions (phase unchanged)
- [ ] Preserve full reconcile on diagnosis transitions

### Step 2: Wire wait loops

- [ ] Sequence waiter uses light reconcile when eligible

### Step 3: Tests

- [ ] Full vs light parity on phase change fixtures
- [ ] Light skips expensive git on stable phase

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #98 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — light reconcile note

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-456): complete Step N — description`
- `fix(SP-456): description`
- `hydrate: SP-456 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
