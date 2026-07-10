# Task: SP-603 — Extract contract-exec.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of contract-verify.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `contract-exec.mjs` — `verifyContract`, `runContractTestCommand`, npm guard (SP-541). Thin shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-585

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/contract-parse.mjs`
- `tests/batch/contract-verify-npm-scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/contract-verify-npm-scope.test.mjs` |
| fileScopeMustChange | `src/batch/contract-exec.mjs`, `src/batch/contract-verify.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-585 complete

### Step 1: Complete split

- [ ] Move remainder; thin `contract-verify.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/contract-verify-npm-scope.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `contract-verify.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-603): complete contract-verify.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
