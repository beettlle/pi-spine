# Task: SP-602 — Extract journal-rebuild-drift.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of journal-rebuild.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `journal-rebuild-drift.mjs` — `reconcileBatchStateDrift`, `detectBatchStateDrift`, done-marker paths. Thin shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-584

## File Scope

- `src/batch/journal-rebuild.mjs`
- `src/batch/journal-rebuild-structural.mjs`
- `tests/batch/done-marker-fail-closed.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/done-marker-fail-closed.test.mjs` |
| fileScopeMustChange | `src/batch/journal-rebuild-drift.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-584 complete

### Step 1: Complete split

- [ ] Move remainder; thin `journal-rebuild.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/done-marker-fail-closed.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `journal-rebuild.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-602): complete journal-rebuild.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`

## Amendments

- Pre-landed redirect (2026-07-11): `fileScopeMustChange` narrowed to `src/batch/journal-rebuild-drift.mjs` only — `journal-rebuild.mjs` already changed on main after v2.3.2 reliability work; new extract file remains the delivery proof.
