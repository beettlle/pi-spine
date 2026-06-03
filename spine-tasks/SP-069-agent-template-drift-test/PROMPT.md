# Task: SP-069 — Agent template drift test

**Created:** 2026-06-03
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Adds regression test asserting worker template documents spine tools, stall checkpoint, coverage policy, and runners do not contradict — small test file, high guardrail value.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Add `tests/agents/template-drift.test.mjs` to catch drift between `templates/agents/worker.md`, runner-generated hints (`src/batch/worker-prompt.mjs` if SP-067 landed), and policy from SP-061. Tests must assert worker.md documents spine Pi tools (`spine_review_step`, `spine_report_progress`), stall checkpoint / `spine_report_progress` heartbeat guidance, and **77% coverage** (when SP-061 landed). Assert runner tail prompt does **not** contradict worker.md on commit format or review ordering.

## Dependencies

- **Task:** SP-067 (shared `worker-prompt.mjs` should exist for runner assertions)

## Context to Read First

**Tier 3:**
- `templates/agents/worker.md` (post SP-062/063/061)
- `src/batch/worker-prompt.mjs` (post SP-067)
- `src/batch/agent-session-worker.mjs` — `buildAgentSessionWorkerPrompt`
- `tests/batch/` — test patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/agents/template-drift.test.mjs` (new)
- `src/batch/worker-prompt.mjs` (read-only; extend exports only if needed for testability)

## Steps

### Step 0: Preflight

- [ ] Read final worker.md and worker-prompt module from SP-067
- [ ] List required substrings / behaviors to lock in tests

### Step 1: Implement drift test

> **Plan-review checkpoint**

- [ ] Create `tests/agents/template-drift.test.mjs` with cases:
  - `worker.md` mentions `spine_review_step`, `spine_report_progress`, stall checkpoint / journal heartbeat
  - `worker.md` mentions **77%** line coverage when SP-061 policy text present (skip or conditional if SP-061 not merged — document in test comment)
  - Runner prompt builder output includes aligned commit hint (from SP-064) and does not contain contradictory legacy phrases
  - Optional: review level > 0 hint present when `readReviewLevel` would return 2

**Artifacts:**
- `tests/agents/template-drift.test.mjs` (new)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Confirm new test fails if worker.md or runner hints regress (sanity: temporarily break locally, revert)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] `tests/agents/template-drift.test.mjs` guards worker template + runner consistency
- [ ] Full test suite green
- [ ] Test documents SP-061 dependency for coverage assertion

## Git Commit Convention

- **Step completion:** `feat(SP-069): complete Step N — description`
- **Tests:** `test(SP-069): add agent template drift guards`

## Do NOT

- Change worker/reviewer template content (prior tasks own that)
- Re-implement SP-067 dedup in this task

## Amendments

_(Workers only.)_
