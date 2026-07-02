# Task: SP-436 — Isolated base integrate core

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** FR-WT-08 land path; multi-module.
**Score:** 6/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement isolated integrate core (#91 / FR-WT-08 slice 1): record `baseBranchHeadAtStart` on batch start; integrate without `git checkout baseBranch` in projectRoot — use integrate worktree or plumbing merge. Human dirty tree on non-base branch no longer blocks.
**GitHub:** [#91](https://github.com/beettlle/pi-spine/issues/91) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #91
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/integrate-worktree.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/integrate-isolated.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-isolated.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Batch snapshot

- [ ] Record baseBranchHeadAtStart + journal batch.base_snapshot

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
- [ ] Update linked GitHub issue with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — concurrent development (interim)

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-436): complete Step N — description`
- `fix(SP-436): description`
- `hydrate: SP-436 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
