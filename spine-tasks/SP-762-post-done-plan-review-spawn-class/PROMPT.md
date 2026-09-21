# Task: SP-762 — Post-DONE plan_review_spawn_failed classification

**Created:** 2026-09-21
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Touches reconcile/classification after plan review spawn failure; must not force expensive worker re-run when `.DONE` + contract artifacts already exist.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** After `.DONE` + contract artifacts, engine plan-review spawn failure (`spawnFailed`, no artifact) still classifies the task as failed / `needs_retry` / `plan_review_spawn_failed`, pushing operators toward retry instead of salvage.

## Mission

Closes #291 — When plan review fails with `spawnFailed` / no artifact **after** `doneInLane=true` (and preferably contract artifacts present), classify toward salvageable / land-loop recovery rather than forced worker retry language. Diagnose headline and `suggestedCommand` must prefer salvage / gate path over `spine batch retry` when lane commits exist. Mirror the spirit of #257 / SP-718 (final-review) for the **plan-review** phase.

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/review-plan.mjs` — plan review spawn failure path
- `src/batch/engine-lanes/review-poll.mjs` — spawnFailed handling
- `src/batch/reconcile-classify.mjs` / `src/batch/reconcile-diagnosis.mjs`
- `spine-tasks/SP-718-salvage-final-review-failure/PROMPT.md` — prior final-review pattern
- GitHub #291

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/reconcile-classify.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `tests/batch/post-done-plan-review-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/post-done-plan-review-spawn.test.mjs` |
| fileScopeMustChange | `tests/batch/post-done-plan-review-spawn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Trace plan-review spawnFailed after doneInLane on current main
- [ ] Compare with SP-718 final-review salvage eligibility
- [ ] Dependencies satisfied

### Step 1: Classification + diagnose

- [ ] Post-DONE plan-review spawnFailed does not force worker-retry as the primary recovery
- [ ] Diagnose maps to salvageable / land-loop guidance when lane commits + doneInLane
- [ ] Regression test for journal/state fixture mirroring #291

**Artifacts:**
- classification/diagnosis modules as needed (modified)
- `tests/batch/post-done-plan-review-spawn.test.mjs` (new)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-766 owns operator docs)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Post-DONE plan-review spawnFailed is salvage-oriented, not forced retry
- [ ] Regression test covers #291 timeline
- [ ] Closes #291

## Git Commit Convention

- `fix(SP-762): post-DONE plan_review_spawn_failed salvage classification (#291)`

## Do NOT

- Disable plan review entirely
- Force auto-integrate without operator gate
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
