# Task: SP-578 — Extract reconcile-classify.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of reconcile split — classification, git inspection, sync (~742 LOC region before `deriveDiagnosis`).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1.

## Mission

Extract `src/batch/reconcile-classify.mjs` from `reconcile.mjs`: `classifyTasks`, `alignTaskClassificationWithStatus`, `syncPersistedClassifications`, `inspectGitState`, `listGitChangedPaths`, `listHumanOnlyPaths`, `inspectHumanBaseSync`, and related helpers through line ~940. Re-export from `reconcile.mjs`. **Do not** move `deriveDiagnosis` or `reconcileBatch` (SP-596).

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593 removes entries after all splits land.

## Dependencies

- **Task:** SP-577

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/reconcile-classify.mjs`
- `tests/batch/reconcile.test.mjs`
- `tests/batch/reconcile-light.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/reconcile-light.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-classify.mjs`, `src/batch/reconcile.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings; confirm split boundary at `deriveDiagnosis`
- [ ] List public exports to preserve on `reconcile.mjs`

### Step 1: Extract reconcile-classify.mjs

- [ ] Create module with classification + git inspection functions
- [ ] Module ≤500 LOC

### Step 2: Re-export shim

- [ ] Re-export from `reconcile.mjs`; remove moved implementations

### Step 3: Testing & Verification

- [ ] `node --test tests/batch/reconcile-light.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `reconcile-classify.mjs` exists; classify/git exports unchanged for importers

## Git Commit Convention

- `refactor(SP-578): extract reconcile-classify.mjs`

## Do NOT

- Move `deriveDiagnosis` / `reconcileBatch` (SP-596)
- Edit `bin/spine-cli/verify.mjs`
