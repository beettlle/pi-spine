# Task: SP-479 — Contract CLI friction fixes

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Ancillary #105 CLI fixes; split from SP-461.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Align `spine wait --until` valid diagnoses with land-loop states; fix invalid `retry --force` suggested command ([#105](https://github.com/beettlle/pi-spine/issues/105) ancillary). Split from SP-461.

## Dependencies

- **Task:** SP-478

## Context to Read First

- GitHub issue #105 friction items
- `bin/spine-wait.mjs`, diagnosis helpers
- Parent split: SP-461
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-wait.mjs`
- `src/batch/diagnosis.mjs`
- `tests/cli/spine-wait-diagnosis.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/spine-wait-diagnosis.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `bin/spine-wait.mjs` |
| artifactsMustExist | `tests/cli/spine-wait-diagnosis.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #105 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: CLI fixes

- [ ] Add gate_open (and related) to spine wait --until valid diagnoses
- [ ] Fix retry --force suggested command when taskId required

### Step 2: Tests

- [ ] Assert wait accepts land-loop diagnoses
- [ ] Assert diagnosis suggests valid retry command

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #105 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — wait/retry friction

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-479): complete Step N — description`
- `fix(SP-479): description`
- `hydrate: SP-479 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
