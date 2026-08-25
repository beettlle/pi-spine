# Task: SP-729 — Extract review-code.mjs + review-final.mjs

**Created:** 2026-08-25
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Phase module extract; high change-risk surface.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #262 — Extract `runCodeReviewPhase` into `review-code.mjs` and `runFinalReviewPhase` into `review-final.mjs`. Thin re-exports from `review.mjs`. No behavior change. Depends on SP-728.

## Dependencies

- **Task:** SP-728 (stub extract complete)

## Context to Read First

- `src/batch/engine-lanes/review.mjs`
- `src/batch/engine-lanes/review-poll.mjs`
- `src/batch/engine-lanes/review-stub.mjs`
- GitHub #262
- Parent split: SP-262 — code/final after stub

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-code.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `src/batch/engine-lanes/review.mjs`
- `tests/batch/final-verdict.test.mjs`
- `tests/batch/review-retry-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/final-verdict.test.mjs tests/batch/review-retry-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review-code.mjs`, `src/batch/engine-lanes/review-final.mjs` |

## Steps

### Step 1: Extract code + final phases

- [ ] Move runCodeReviewPhase to review-code.mjs
- [ ] Move runFinalReviewPhase to review-final.mjs
- [ ] Re-export from review.mjs coordinator

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:** none expected

## Completion Criteria

- [ ] code and final modules exist; behavior unchanged
- [ ] `.DONE` created

## Do NOT

- Extract plan phase yet (SP-730)
- Grow ALLOWED_CLUSTER_CYCLES
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-729): extract review-code and review-final (#262)`
