# Task: SP-605 — Extract salvage-batch-integrate.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of salvage-batch.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `salvage-batch-integrate.mjs` — `integrateSalvageableLane`, `confirmSalvageIntegrate`, formatters. Thin shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-591

## File Scope

- `src/batch/salvage-batch.mjs`
- `src/batch/salvage-batch-list.mjs`
- `tests/batch/batch-salvage-integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/batch-salvage-integrate.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch-integrate.mjs`, `src/batch/salvage-batch.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-591 complete

### Step 1: Complete split

- [ ] Move remainder; thin `salvage-batch.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/batch-salvage-integrate.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `salvage-batch.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-605): complete salvage-batch.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
