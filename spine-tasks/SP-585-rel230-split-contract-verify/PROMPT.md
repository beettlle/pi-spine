# Task: SP-585 — Extract contract-parse.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of contract-verify.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `contract-parse.mjs` — contract field parsing, `listChangedFiles`, file-scope matchers. Leave execution/npm guard for SP-603.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-599 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/contract-parse.mjs`
- `tests/batch/contract-verify-scoped.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/contract-verify-scoped.test.mjs` |
| fileScopeMustChange | `src/batch/contract-parse.mjs`, `src/batch/contract-verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for contract-verify.mjs
- [ ] List public exports to preserve

### Step 1: Extract contract-parse.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from contract-verify.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/contract-verify-scoped.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-585): extract contract-parse.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
