# Task: SP-596 — Extract reconcile-diagnosis.mjs

**Created:** 2026-07-10
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Second half of reconcile split — `deriveDiagnosis`, `reconcileBatch`, `runReconciliationCheck`, `reconcileOrphanRunningState` (~773 LOC region).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract `src/batch/reconcile-diagnosis.mjs` from `reconcile.mjs` after SP-578. Move diagnosis derivation and main reconcile orchestration. Thin `reconcile.mjs` to re-export shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-578

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/reconcile-classify.mjs`
- `tests/batch/reconcile.test.mjs`
- `tests/batch/orphan-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-diagnosis.mjs`, `src/batch/reconcile.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-578 complete; `reconcile-classify.mjs` on main
- [ ] Read remaining body of `reconcile.mjs` from `deriveDiagnosis` onward

### Step 1: Extract reconcile-diagnosis.mjs

- [ ] Move `deriveDiagnosis`, `reconcileBatch`, `runReconciliationCheck`, `reconcileOrphanRunningState`
- [ ] Module ≤500 LOC; split further if needed

### Step 2: Thin reconcile.mjs shim

- [ ] Re-export all public symbols from classify + diagnosis modules
- [ ] `reconcile.mjs` ≤500 LOC

### Step 3: Testing & Verification

- [ ] `node --test tests/batch/reconcile.test.mjs`
- [ ] `node --test tests/batch/orphan-reconcile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `reconcile.mjs` ≤500 LOC; full reconcile API preserved

## Git Commit Convention

- `refactor(SP-596): extract reconcile-diagnosis.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change reconcile behavior
