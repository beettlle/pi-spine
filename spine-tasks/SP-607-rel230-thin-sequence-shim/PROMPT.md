# Task: SP-607 — Thin sequence.mjs to re-export shim

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Follow-on LOC fix so SP-593 can empty PHASE23_GRANDFATHERED_OVER_500 (#192).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

`sequence-plan.mjs`, `sequence-run.mjs`, and `sequence-wait.mjs` already hold the implementations, but `sequence.mjs` still duplicates ~581 LOC. Replace `sequence.mjs` with a re-export shim (≤500 LOC) preserving `buildSequencePlan`, `runSequence`, wait/land helpers, and plan exports for `src/cli/sequence.mjs`.

**Closes:** partial #117; unblocks SP-593 / #192

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-600

## File Scope

- `src/batch/sequence.mjs`
- `src/batch/sequence-run.mjs`
- `src/batch/sequence-wait.mjs`
- `src/batch/sequence-plan.mjs`
- `tests/batch/sequence-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/sequence-preflight.test.mjs` |
| fileScopeMustChange | `src/batch/sequence.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current LOC >500 for target module(s)
- [ ] Preserve public exports via re-export

### Step 1: Extract / thin

- [ ] Complete Mission; each resulting file ≤500 LOC

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/sequence-preflight.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Target module(s) ≤500 LOC; public API unchanged

## Git Commit Convention

- `refactor(SP-607): rel230 thin sequence shim`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
