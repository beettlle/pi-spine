# Task: SP-597 — Extract review-spawn remainder

**Created:** 2026-07-10
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Second half of review split — `runStepReview`, spawn honor paths, `assertReviewToolAvailable`; thin `review.mjs` to ≤500 LOC.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

After SP-579, move spawn orchestration remainder from `review.mjs` into focused module(s). Thin `review.mjs` to re-export shim ≤500 LOC. Preserve `review-spawn.mjs` integration.

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-579

## File Scope

- `src/batch/review.mjs`
- `src/batch/review-spawn.mjs`
- `src/batch/review-artifacts.mjs`
- `tests/batch/review-retry-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/review-retry-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/review.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-579 complete

### Step 1: Extract spawn remainder

- [ ] Move `runStepReview`, honor/spawn completion paths
- [ ] Keep `review.mjs` ≤500 LOC

### Step 2: Re-export shim

- [ ] All public exports preserved

### Step 3: Testing & Verification

- [ ] `node --test tests/batch/review-retry-reconcile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `review.mjs` ≤500 LOC; review spawn API unchanged

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
