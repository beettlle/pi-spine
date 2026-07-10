# Task: SP-579 — Extract review-artifacts.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of review split — artifact discovery, level parsing, honor-signal helpers (`review-shared.mjs` already exists).
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `src/batch/review-artifacts.mjs`: `readReviewLevel`, `find*Review*` artifact discovery, honor-signal helpers, `buildReviewHonorHeadlineSuffix`. Keep `runStepReview` and spawn wiring in `review.mjs` for SP-597. Re-export from `review.mjs`.

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577

## File Scope

- `src/batch/review.mjs`
- `src/batch/review-artifacts.mjs`
- `src/batch/review-shared.mjs`
- `tests/batch/review-retry-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/review-retry-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/review-artifacts.mjs`, `src/batch/review.mjs` |

## Steps

### Step 0: Preflight

- [ ] Note existing `review-spawn.mjs` and `review-shared.mjs` — do not duplicate

### Step 1: Extract review-artifacts.mjs

- [ ] Move artifact discovery + honor helpers
- [ ] Module ≤500 LOC

### Step 2: Re-export shim

- [ ] Re-export from `review.mjs`

### Step 3: Testing & Verification

- [ ] `node --test tests/batch/review-retry-reconcile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Artifact discovery API unchanged for engine-lanes consumers

## Do NOT

- Move `runStepReview` (SP-597)
- Edit `bin/spine-cli/verify.mjs`
