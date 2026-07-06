# Task: SP-502 — Preflight batch-read PROMPT.md async

**Created:** 2026-07-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Replace synchronous per-task `readFileSync` loops in two preflight helpers with batched async reads. Single-module performance fix; no API surface change.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-502-preflight-async-prompt-read/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Replace per-task `fs.readFileSync` loops in `spine-preflight-lib.mjs` (approximately lines 738–753 in `checkTasksValidate` and 1092–1106 in `listPrelandedFileScopeStaleTasks`) with `fs.promises.readFile` batched via `Promise.all` or an equivalent read cache. Preserve existing validation behavior and error messages — this is an I/O performance fix only.

**Closes:** [#183](https://github.com/beettlle/pi-spine/issues/183)

## Dependencies

- **Task:** SP-500 (ESLint baseline must land before preflight-lib edits in same release wave)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/config/spine-preflight-lib.mjs` — `checkTasksValidate` and `listPrelandedFileScopeStaleTasks`

## Environment

- **Workspace:** `src/config/`
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `tests/config/spine-preflight.test.mjs`
- `tests/config/spine-preflight-prelanded.test.mjs`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/config/spine-preflight.test.mjs tests/config/spine-preflight-prelanded.test.mjs tests/spine-preflight.test.mjs` |
| fileScopeMustChange | `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read both `readFileSync` loops in `spine-preflight-lib.mjs` (~738–753, ~1092–1106)
- [ ] Identify existing preflight tests covering tasks-validate and prelanded file-scope warnings
- [ ] Dependencies satisfied

### Step 1: Batch async PROMPT reads

- [ ] Extract a shared helper (or inline `Promise.all`) to read multiple `PROMPT.md` files concurrently
- [ ] Refactor `checkTasksValidate` to use async reads without changing validation outcomes
- [ ] Refactor `listPrelandedFileScopeStaleTasks` similarly (async function or internal await chain)
- [ ] Update callers if function signatures become async (preserve exported API behavior)

**Artifacts:**
- `src/config/spine-preflight-lib.mjs` (modified)

### Step 2: Test coverage

- [ ] Add or extend tests proving tasks-validate and prelanded warnings still work with async reads
- [ ] Run targeted tests: `npm test -- tests/config/spine-preflight.test.mjs tests/config/spine-preflight-prelanded.test.mjs tests/spine-preflight.test.mjs`

**Artifacts:**
- `tests/config/spine-preflight.test.mjs` and/or `tests/config/spine-preflight-prelanded.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #183: `gh issue close 183 --comment "Preflight PROMPT reads batched async — SP-502"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] No per-task `readFileSync` loops remain in the two targeted code paths
- [ ] Preflight validation behavior unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-502): complete Step N — description`
- **Bug fixes:** `fix(SP-502): description`
- **Tests:** `test(SP-502): description`

## Do NOT

- Split `spine-preflight-lib.mjs` into new modules (SP-503+ scope)
- Change validation rules or error message text
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
