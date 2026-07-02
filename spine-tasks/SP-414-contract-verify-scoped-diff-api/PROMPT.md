# Task: SP-414 — Contract verify scoped diff API

**Created:** 2026-07-01
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Add sinceCommit parameter to listChangedFiles.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Start **GitHub issue #62**: extend `listChangedFiles(worktreePath, baseBranch, sinceCommit?)` — when `sinceCommit` provided, diff `sinceCommit..HEAD` instead of `main...HEAD` for per-task scoped file lists.

## Dependencies

- **None**

## Context to Read First

- GitHub issue #62
- `src/batch/contract-verify.mjs`
- stet batch `20260701T020526`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-verify-scoped.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-scoped.test.mjs tests/batch/contract-verify.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/contract-verify-scoped.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #62 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read issue #62 cumulative diff failure examples

### Step 2: Scoped listChangedFiles

- [ ] Add optional `sinceCommit` (SHA or ref) parameter
- [ ] Use `git diff --name-only sinceCommit..HEAD` when set
- [ ] Preserve `main...HEAD` when sinceCommit omitted

### Step 3: Unit tests

- [ ] Test fixture worktree with two commits — scoped diff returns only second commit files
- [ ] Existing contract-verify tests still pass

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-414): complete Step N — description`
- `fix(SP-414): description`
- `test(SP-414): description`

## Do NOT

- Wire engine yet (SP-416)
- Change planner behavior

---

## Amendments (Added During Execution)
