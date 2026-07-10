# Task: SP-591 — Extract salvage-batch-list.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of salvage-batch.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `salvage-batch-list.mjs` — `listSalvageableLanes`, `formatSalvageListOutput`, `isNonSalvageableExitReason`. Leave integrate for SP-605.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-603 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/salvage-batch.mjs`
- `src/batch/salvage-batch-list.mjs`
- `tests/batch/batch-salvage-list.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/batch-salvage-list.test.mjs` |
| fileScopeMustChange | `src/batch/salvage-batch-list.mjs`, `src/batch/salvage-batch.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for salvage-batch.mjs
- [ ] List public exports to preserve

### Step 1: Extract salvage-batch-list.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from salvage-batch.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/batch-salvage-list.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-591): extract salvage-batch-list.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
