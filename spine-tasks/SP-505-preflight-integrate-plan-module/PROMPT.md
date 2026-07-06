# Task: SP-505 — Split preflight: integrate + plan module

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Final preflight Strangler slice — extract integrate/merge/plan checks and thin `spine-preflight-lib.mjs` to ≤500 LOC of orchestration + re-exports. Closes the #176 epic.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-505-preflight-integrate-plan-module/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract integrate, merge-risk, and plan preflight checks from `spine-preflight-lib.mjs` into `src/config/preflight/integrate-plan.mjs` (target ≤500 LOC). Move at minimum: orch-merge conflict helpers (`listDivergentOrchMergeRiskPaths`, `predictOrchMergeConflictRisk`, `checkOrchMergeConflictWarn`), prelanded file-scope warnings (`listPrelandedFileScopeStaleTasks`, `checkPrelandedFileScopeWarn`), `runPreflightPlanCheck`, and related private formatters. Thin `spine-preflight-lib.mjs` to ≤500 LOC — retain `runBatchPreflight`, `formatPreflightHuman`, doctor/root checks, and re-exports only.

**Closes:** [#176](https://github.com/beettlle/pi-spine/issues/176)

## Dependencies

- **Task:** SP-504 (git-batch module must land first)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/config/spine-preflight-lib.mjs` — integrate/plan sections
- `src/config/preflight/discovery.mjs`, `src/config/preflight/git-batch.mjs` — prior extracts

## Environment

- **Workspace:** `src/config/`
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `src/config/preflight/integrate-plan.mjs`
- `tests/config/spine-preflight-prelanded.test.mjs`
- `tests/config/spine-preflight-orch-conflict.test.mjs`
- `tests/config/spine-preflight.test.mjs`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/config/spine-preflight-prelanded.test.mjs tests/config/spine-preflight-orch-conflict.test.mjs tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs` |
| fileScopeMustChange | `src/config/preflight/integrate-plan.mjs`, `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-504 complete
- [ ] Measure current `spine-preflight-lib.mjs` LOC and list remaining integrate/plan functions
- [ ] Dependencies satisfied

### Step 1: Create integrate-plan.mjs module

- [ ] Create `src/config/preflight/integrate-plan.mjs` with orch-merge, prelanded, and plan check logic
- [ ] Move private git-ref helpers used only by these checks
- [ ] Keep module ≤500 LOC

**Artifacts:**
- `src/config/preflight/integrate-plan.mjs` (new)

### Step 2: Thin spine-preflight-lib to re-exports

- [ ] Remove moved implementations from `spine-preflight-lib.mjs`
- [ ] Re-export moved symbols; keep `runBatchPreflight` and `formatPreflightHuman` as thin orchestrators
- [ ] Verify `spine-preflight-lib.mjs` is ≤500 LOC

**Artifacts:**
- `src/config/spine-preflight-lib.mjs` (modified)

### Step 3: Regression tests

- [ ] Run prelanded, orch-conflict, and general preflight tests
- [ ] Run targeted tests: `npm test -- tests/config/spine-preflight-prelanded.test.mjs tests/config/spine-preflight-orch-conflict.test.mjs tests/config/spine-preflight.test.mjs tests/spine-preflight.test.mjs`

**Artifacts:**
- Test files (modified only if import paths change)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #176: `gh issue close 176 --comment "Preflight split complete — SP-503/504/505"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `integrate-plan.mjs` exists and is ≤500 LOC
- [ ] `spine-preflight-lib.mjs` is ≤500 LOC
- [ ] Public preflight API unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-505): complete Step N — description`
- **Bug fixes:** `fix(SP-505): description`
- **Tests:** `test(SP-505): description`

## Do NOT

- Change preflight check ordering or CLI output format
- Re-expand spine-preflight-lib beyond 500 LOC
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
