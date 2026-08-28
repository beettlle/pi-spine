# Task: SP-732 — Remove fake-async in batch merge, queue, review-spawn

**Created:** 2026-08-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Hot batch paths; medium blast radius on merge/resume/review spawn.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #270 — Remove `async` from batch exports that run synchronously: `mergeWaveLanesToOrch`, `skipTaskDoneOnDisk`, and `spawnReviewerPi`. Optionally add `tests/arch/fake-async.test.mjs` guard for new fake-async in `src/batch/**` (allowlist during migration if needed).

## Dependencies

- **None**

## Context to Read First

- GitHub #270 — batch function rows in evidence table
- `src/batch/engine-lanes/merge.mjs`, `src/batch/engine-lanes/queue.mjs`, `src/batch/review-spawn.mjs`
- `tests/batch/final-verdict.test.mjs`, `tests/batch/run-metrics.test.mjs`, `tests/batch/review-spawn.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/engine-lanes/queue.mjs`
- `src/batch/review-spawn.mjs`
- `tests/batch/final-verdict.test.mjs`
- `tests/batch/run-metrics.test.mjs`
- `tests/batch/review-spawn.test.mjs`
- `tests/arch/fake-async.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/final-verdict.test.mjs tests/batch/run-metrics.test.mjs tests/batch/review-spawn.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/merge.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-731 is not required (disjoint scopes — merge/queue/review-spawn only)
- [ ] Read #270 batch acceptance criteria

### Step 1: Remove fake-async on batch exports

- [ ] `mergeWaveLanesToOrch`, `skipTaskDoneOnDisk`, `spawnReviewerPi` — sync or real async
- [ ] Update importers (`engine-lanes.mjs`, `resume-multi.mjs`, tests) if signatures change

### Step 2: Optional arch guard

- [ ] Add `tests/arch/fake-async.test.mjs` listing migrated symbols (allowlist empty when done)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- None required

## Completion Criteria

- [ ] All three batch exports fixed per #270
- [ ] Scoped tests pass
- [ ] `.DONE` created

## Do NOT

- Start import-cycle refactor (#267 — SP-733+)
- Modify CLI fake-async paths (SP-731)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `fix(SP-732): remove fake-async in batch paths (#270)`
