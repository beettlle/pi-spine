# Task: SP-475 — Integrate isolated merge path

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** #91 slice 1b; split from SP-436.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement isolated integrate: `integrate-worktree.mjs`, never `git checkout baseBranch` in projectRoot; human dirty tree on non-base branch no longer blocks ([#91](https://github.com/beettlle/pi-spine/issues/91) partial). Split from SP-436.

## Dependencies

- **Task:** SP-474

## Context to Read First

- GitHub issue #91 FR-WT-08
- `src/batch/integrate.mjs`
- Parent split: SP-436
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/integrate-worktree.mjs`
- `tests/batch/integrate-isolated.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-isolated.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `tests/batch/integrate-isolated.test.mjs` |
| artifactsMustExist | `tests/batch/integrate-isolated.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Isolated merge path

- [ ] Add integrate-worktree.mjs
- [ ] Never checkout baseBranch in projectRoot during integrate

### Step 2: Tests

- [ ] Integrate succeeds with dirty human worktree on main (uncommitted)
- [ ] Conflict path unchanged

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #91 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — concurrent development (interim)

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-475): complete Step N — description`
- `fix(SP-475): description`
- `hydrate: SP-475 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)

- fileScopeMustChange updated from `src/batch/integrate-worktree.mjs` (pre-landed by SP-436/SP-439) to `tests/batch/integrate-isolated.test.mjs` — the delivery artifact that must still be created.
