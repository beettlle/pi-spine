# Task: SP-116 — batch-state-io extract and git error surfacing

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** state↔reconcile cycle + silent git catch blocks in reconcile.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract `loadBatchStateFile`/`parseBatchState` to `batch-state-io.mjs` breaking state↔reconcile cycle. Surface git inspection failures instead of empty catch.

**Source:** SP-106 Findings #4, #6 (MEDIUM).

## Dependencies

- **None**

## File Scope

- `src/batch/batch-state-io.mjs` (new)
- `src/batch/state.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/reconcile-git-error.test.mjs` (new)

## Steps

### Step 1: Extract IO module
- [ ] Move load/parse/resolve paths to batch-state-io.mjs
- [ ] Update imports in state + reconcile

### Step 2: Git error surfacing
- [ ] Replace empty catch with structured hint or git_unavailable diagnosis

### Step 3: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] No circular import state↔reconcile
- [ ] Git failure produces actionable diagnosis

## Git Commit Convention
- `refactor(SP-116): batch-state-io extract and git error surfacing`

## Do NOT
- Change batch-state.json schema

---

## Amendments (Added During Execution)
