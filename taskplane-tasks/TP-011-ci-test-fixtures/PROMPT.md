# Task: TP-011 — CI test fixture hardening

**Created:** 2026-06-01
**Size:** S

## Review Level: 1 (Plan review before code)

**Assessment:** Test-only changes to fix GitHub Actions failure on TP-009; shared git fixture helper must not alter production reconciliation behavior.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix CI failure introduced when TP-009 landed on `main` (GitHub Actions run on commit `fc82d24`): test `completed_manual when orch branch merged to main` fails on Ubuntu with `git checkout main` because temp repos from `git init` do not guarantee a `main` branch. Also harden preflight test teardown to avoid flaky `ENOTEMPTY` on `.git/objects` during parallel cleanup.

**Success:** `npm test` passes 46/46 locally and on GitHub Actions CI for every push to `main`.

## Dependencies

- **TP-010** — Phase 1b complete; avoid merge conflicts with lifecycle CLI work in flight

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `tests/batch/reconcile.test.mjs` — failing `completed_manual` test (lines ~66–88)
- `tests/spine-preflight.test.mjs` — duplicate `createProjectFixture`, flaky `runBatchPreflight passes on initialized clean fixture`
- `.github/workflows/ci.yml` — CI runs `npm test`
- GitHub Actions failure reference: run `26769597878` on `main` (`completed_manual` → `Command failed: git checkout main`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (verify with local `npm test`; confirm CI green after push)

## File Scope

- `tests/helpers/git-fixture.mjs` (new)
- `tests/batch/reconcile.test.mjs`
- `tests/spine-preflight.test.mjs`
- `.github/workflows/ci.yml` (optional 2-line git config step)

## Steps

### Step 0: Preflight

- [ ] Reproduce CI failure locally if possible: `npm test -- tests/batch/reconcile.test.mjs`
- [ ] Confirm failing subtest: `completed_manual when orch branch merged to main`
- [ ] Confirm TP-010 is merged to `main` before starting (no overlapping lifecycle edits)

### Step 1: Shared git test helper

> **Plan-review checkpoint** — confirm helper API (`initGitRepo`, `destroyGitRepo`) before refactoring callers.

- [ ] Create `tests/helpers/git-fixture.mjs` exporting:
  - `initGitRepo(projectRoot, options?)` — `git init`, user config, initial commit, **`git branch -M main`** (or `git init -b main` where appropriate)
  - `destroyGitRepo(projectRoot)` — `fs.rm` with `{ recursive: true, force: true, maxRetries: 3, retryDelay: 100 }`
- [ ] Document in file header: all reconcile/preflight temp repos must use this helper so `baseBranch: main` in fixtures matches git reality

**Artifacts:**
- `tests/helpers/git-fixture.mjs` (new)

### Step 2: Refactor reconcile tests

- [ ] Replace local `createProjectFixture` in `tests/batch/reconcile.test.mjs` with `initGitRepo` + `destroyGitRepo` from helper
- [ ] Ensure `completed_manual when orch branch merged to main` still:
  - Creates orch branch from fixture `orchBranch`
  - Merges into `main`
  - Asserts `reconcileBatch` → `diagnosis: completed_manual`, `suggestedCommand: spine batch dismiss`
- [ ] Run targeted tests: `node --test tests/batch/reconcile.test.mjs`

**Artifacts:**
- `tests/batch/reconcile.test.mjs` (modified)

### Step 3: Refactor preflight tests and fix teardown flake

- [ ] Replace duplicate `createProjectFixture` in `tests/spine-preflight.test.mjs` with shared `initGitRepo` / `destroyGitRepo`
- [ ] Use `destroyGitRepo` in all `finally` blocks (replace bare `rm` for git-backed fixtures)
- [ ] If `runBatchPreflight passes on initialized clean fixture` still flakes, set `test(..., { concurrency: false })` for that single test only (last resort; document why in STATUS Discoveries)

**Artifacts:**
- `tests/spine-preflight.test.mjs` (modified)

### Step 4: CI workflow hardening (optional but recommended)

- [ ] Add step before `npm test` in `.github/workflows/ci.yml`:
  - `git config --global init.defaultBranch main`
- [ ] Keep step name clear: `Configure git for test fixtures`

**Artifacts:**
- `.github/workflows/ci.yml` (modified)

### Step 5: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` twice in a row — must be **46/46** both times
- [ ] Push to `main` (or open PR) and confirm GitHub Actions **CI** workflow succeeds
- [ ] Log CI run URL in STATUS.md Execution Log

### Step 6: Documentation & Delivery

- [ ] Add one line to `taskplane-tasks/CONTEXT.md` Technical Debt: CI red on TP-009 until TP-011 — fixed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `taskplane-tasks/CONTEXT.md` — note CI fix landed (Technical Debt / Current State)

**Check If Affected:**
- `README.md` — only if adding CI badge or test conventions section (optional)

## Completion Criteria

- [ ] `tests/helpers/git-fixture.mjs` exists and is used by reconcile + preflight tests
- [ ] `completed_manual when orch branch merged to main` passes on Linux (CI)
- [ ] Full suite 46/46 pass locally and on GitHub Actions
- [ ] No changes to `src/batch/reconcile.mjs` unless a real logic bug is proven (test-only task by default)

## Git Commit Convention

- **Step completion:** `fix(TP-011): complete Step N — description`

## Do NOT

- Implement TP-010 lifecycle features (already TP-010 scope)
- Skip or disable `completed_manual` on CI
- Change reconciliation diagnosis rules without evidence of production bug
- Start before TP-010 is integrated to `main`

---

## Amendments (Added During Execution)
