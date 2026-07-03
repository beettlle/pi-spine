# Task: SP-470 — Gitignored index vs worktree detection

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Core #95 fix; split from SP-430.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Distinguish index-tracked vs worktree-only gitignored dirt; fix remediation message when `git ls-files` is empty ([#95](https://github.com/beettlle/pi-spine/issues/95) partial). Split from SP-430.

## Dependencies

- **Task:** SP-427 (dirty-worktree-coverage-hygiene)

## Context to Read First

- GitHub issue #95
- `src/batch/lane-dirty-check.mjs`
- Parent split: SP-430
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `tests/batch/gitignored-index-detect.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/gitignored-index-detect.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs` |
| artifactsMustExist | `tests/batch/gitignored-index-detect.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #95 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Index vs worktree

- [ ] Detect worktree-only gitignored paths vs index-tracked
- [ ] Do not suggest git rm --cached when ls-files empty

### Step 2: Regression

- [ ] Reproduce batch 20260702T061256 SP-011 scenario (detection only)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #95 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gitignored artifact remediation

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-470): complete Step N — description`
- `fix(SP-470): description`
- `hydrate: SP-470 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
