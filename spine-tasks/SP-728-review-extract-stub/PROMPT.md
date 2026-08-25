# Task: SP-728 — Extract review-stub.mjs; pass stub queues via params

**Created:** 2026-08-25
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Remove process.env stub mutation; safer under parallel lanes.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #262 — Extract env stub verdict queue handling into `review-stub.mjs`. Pass queues via function params — no `process.env` stub mutation. Depends on SP-727.

## Dependencies

- **Task:** SP-727 (poll extract complete)

## Context to Read First

- `src/batch/engine-lanes/review.mjs` — process.env stub queue mutation
- `src/batch/engine-lanes/review-poll.mjs`
- GitHub #262
- Parent split: SP-262 — stub extract after poll

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-stub.mjs`
- `src/batch/engine-lanes/review.mjs`
- `tests/batch/final-verdict.test.mjs`
- `tests/batch/review-retry-reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/final-verdict.test.mjs tests/batch/review-retry-reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review-stub.mjs` |

## Steps

### Step 1: Extract stub queues

- [ ] Move stub verdict queue handling to `review-stub.mjs`
- [ ] Pass queues via params; remove process.env mutation for stubs

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:** none expected

## Completion Criteria

- [ ] Stub queues not mutated via process.env
- [ ] Review/retry tests green
- [ ] `.DONE` created

## Do NOT

- Extract code/final/plan phases yet
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-728): extract review-stub; paramize stub queues (#262)`
