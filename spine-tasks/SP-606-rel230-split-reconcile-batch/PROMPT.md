# Task: SP-606 — Split reconcile-diagnosis into batch + orphan

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Follow-on LOC fix so SP-593 can empty PHASE23_GRANDFATHERED_OVER_500 (#192).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Extract `reconcileBatch` → `src/batch/reconcile-batch.mjs` and `runReconciliationCheck` + `reconcileOrphanRunningState` → `src/batch/reconcile-orphan.mjs`. Keep `deriveDiagnosis` + helpers in `reconcile-diagnosis.mjs`. Re-export from `reconcile.mjs` / `reconcile-diagnosis.mjs`. Each file ≤500 LOC.

**Closes:** partial #117; unblocks SP-593 / #192

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-596

## File Scope

- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/reconcile-batch.mjs`
- `src/batch/reconcile-orphan.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/reconcile.test.mjs`
- `tests/batch/orphan-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/reconcile-batch.mjs`, `src/batch/reconcile-orphan.mjs`, `src/batch/reconcile-diagnosis.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current LOC >500 for target module(s)
- [ ] Preserve public exports via re-export

### Step 1: Extract / thin

- [ ] Complete Mission; each resulting file ≤500 LOC

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/reconcile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Target module(s) ≤500 LOC; public API unchanged

## Git Commit Convention

- `refactor(SP-606): rel230 split reconcile batch`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
