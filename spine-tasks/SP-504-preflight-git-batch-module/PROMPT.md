# Task: SP-504 — Split preflight: git + batch guard module

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig extract of git-clean and active-batch guard checks into `git-batch.mjs`. Continues #176 preflight split after discovery module lands.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-504-preflight-git-batch-module/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract git-clean and active-batch guard checks from `spine-preflight-lib.mjs` into `src/config/preflight/git-batch.mjs` (target ≤500 LOC). Move at minimum: `isPiSessionMetadataPath`, `filterPiSessionDirtyPaths`, `listHumanDirtyPaths`, `resolveCurrentGitBranch`, `checkGitClean`, batch-state helpers (`resolveBatchStatePath`, `loadBatchState`, `isHealthyActiveBatch`), and `checkNoActiveBatch`. Re-export from `spine-preflight-lib.mjs`.

**Partial:** [#176](https://github.com/beettlle/pi-spine/issues/176)

## Dependencies

- **Task:** SP-503 (discovery module must land first — same spine-preflight-lib file)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/config/spine-preflight-lib.mjs` — git-clean and batch guard sections
- `src/config/preflight/discovery.mjs` — prior extract pattern

## Environment

- **Workspace:** `src/config/`
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `src/config/preflight/git-batch.mjs`
- `tests/config/spine-preflight.test.mjs`
- `tests/spine-preflight.test.mjs`
- `tests/batch/sequence-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs tests/batch/sequence-preflight.test.mjs` |
| fileScopeMustChange | `src/config/preflight/git-batch.mjs`, `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-503 complete
- [ ] Read git-clean and checkNoActiveBatch implementations
- [ ] Dependencies satisfied

### Step 1: Create git-batch.mjs module

- [ ] Create `src/config/preflight/git-batch.mjs` with git-clean and batch guard logic
- [ ] Move private helpers (`resolveBatchStatePath`, `loadBatchState`, etc.) with their checks
- [ ] Keep module ≤500 LOC

**Artifacts:**
- `src/config/preflight/git-batch.mjs` (new)

### Step 2: Re-export from spine-preflight-lib

- [ ] Remove moved implementations from `spine-preflight-lib.mjs`
- [ ] Re-export moved symbols from `git-batch.mjs`
- [ ] Preserve `.pi/` dirty-path filtering behavior (SP-423)

**Artifacts:**
- `src/config/spine-preflight-lib.mjs` (modified)

### Step 3: Regression tests

- [ ] Run preflight and sequence-preflight tests
- [ ] Add targeted test for git-batch module if coverage gap
- [ ] Run targeted tests: `npm test -- tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs tests/batch/sequence-preflight.test.mjs`

**Artifacts:**
- `tests/config/spine-preflight.test.mjs` (modified if needed)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `git-batch.mjs` exists and is ≤500 LOC
- [ ] Git-clean and no-active-batch behavior unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-504): complete Step N — description`
- **Bug fixes:** `fix(SP-504): description`
- **Tests:** `test(SP-504): description`

## Do NOT

- Extract integrate/plan checks (SP-505 scope)
- Change git-clean allowlist or batch guard rules
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
