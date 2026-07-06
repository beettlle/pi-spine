# Task: SP-503 — Split preflight: discovery + validate module

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig extract of task discovery and tasks-validate checks from the 1300+ LOC preflight lib into a focused module (≤500 LOC). Re-export from spine-preflight-lib to preserve public API.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-503-preflight-discovery-module/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract task discovery helpers and tasks-validate-related checks from `spine-preflight-lib.mjs` into `src/config/preflight/discovery.mjs` (target ≤500 LOC). Move at minimum: `resolveTasksRoot`, `discoverTaskFolders`, `discoverTaskIds`, `taskIdFromFolder`, `checkTasksRoot`, `checkDependenciesJson`, `checkWorktreeSetupHook`, and `checkTasksValidate` (including async PROMPT reads from SP-502). Re-export all moved symbols from `spine-preflight-lib.mjs` so existing importers unchanged.

**Partial:** [#176](https://github.com/beettlle/pi-spine/issues/176)

## Dependencies

- **Task:** SP-502 (async PROMPT reads must land first — same hot functions)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/config/spine-preflight-lib.mjs` — functions to extract
- `spine-tasks/_authoring/release-v1.8.0/manifest.md` — wave 2 preflight split plan

## Environment

- **Workspace:** `src/config/`
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `src/config/preflight/discovery.mjs`
- `tests/config/spine-preflight.test.mjs`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs` |
| fileScopeMustChange | `src/config/preflight/discovery.mjs`, `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-502 complete (async PROMPT reads merged)
- [ ] List discovery + tasks-validate functions to move (see Mission)
- [ ] Dependencies satisfied

### Step 1: Create discovery.mjs module

- [ ] Create `src/config/preflight/discovery.mjs` with extracted discovery and tasks-validate logic
- [ ] Keep module ≤500 LOC; move private helpers with their public callers
- [ ] Preserve JSDoc and error messages exactly

**Artifacts:**
- `src/config/preflight/discovery.mjs` (new)

### Step 2: Thin spine-preflight-lib re-exports

- [ ] Remove moved implementations from `spine-preflight-lib.mjs`
- [ ] Re-export moved symbols from `discovery.mjs` (same export names)
- [ ] Verify no import path changes required for external callers

**Artifacts:**
- `src/config/spine-preflight-lib.mjs` (modified)

### Step 3: Tests and regression

- [ ] Run existing preflight tests unchanged (or update imports only if test internals moved)
- [ ] Add test import of `discovery.mjs` if coverage gap on extracted module
- [ ] Run targeted tests: `npm test -- tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs`

**Artifacts:**
- `tests/config/spine-preflight.test.mjs` (modified if needed)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Note partial #176 progress in STATUS (full close in SP-505)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `discovery.mjs` exists and is ≤500 LOC
- [ ] Public preflight API unchanged (re-exports from spine-preflight-lib)

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-503): complete Step N — description`
- **Bug fixes:** `fix(SP-503): description`
- **Tests:** `test(SP-503): description`

## Do NOT

- Extract git-clean, batch guard, or integrate/plan checks (SP-504/SP-505 scope)
- Change preflight check behavior or CLI output
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
