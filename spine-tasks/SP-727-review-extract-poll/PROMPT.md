# Task: SP-727 — Extract review-poll.mjs from review.mjs

**Created:** 2026-08-25
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** First slice of #262 strangler; shared poll loops.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #262 — Extract shared review poll loops into `src/batch/engine-lanes/review-poll.mjs`. `review.mjs` imports the helper. No behavior change. Requires SP-725 caps landed first.

## Dependencies

- **Task:** SP-725 (review attempt caps land before review.mjs structural split)

## Context to Read First

- `src/batch/engine-lanes/review.mjs` — three while(true) poll loops
- GitHub #262
- Parent split: SP-262 epic — poll extract first

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-poll.mjs`
- `src/batch/engine-lanes/review.mjs`
- `tests/batch/final-verdict.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/final-verdict.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/review-poll.mjs` |

## Steps

### Step 1: Extract poll helper

- [ ] Move shared poll-loop logic into `review-poll.mjs`
- [ ] Wire `review.mjs` to import without behavior change

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:** none expected

## Completion Criteria

- [ ] review-poll.mjs exists and is used
- [ ] Existing review tests pass
- [ ] `.DONE` created

## Do NOT

- Extract phase modules yet (SP-728+)
- Grow ALLOWED_CLUSTER_CYCLES
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `refactor(SP-727): extract review-poll from review.mjs (#262)`
