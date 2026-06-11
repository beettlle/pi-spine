# Task: SP-195 — Engine code review phase (RL≥2)

**Created:** 2026-06-11
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Architectural fix — move code review off worker onto engine (like final review SP-151/192 pattern).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

For tasks with **Review Level ≥ 2**, run **code review from the engine** after worker success and before final review — not from nested `spine_review_step` inside the pi worker.

**Incident:** SP-190 (RL2) — worker ran plan review via tool; code review spawn hung; engine never reached lane commit.

**Deliverables:**
1. `runCodeReviewPhase()` (or extend existing review hooks) in `engine-lanes.mjs` after `runWorker` success, before `runFinalReviewPhase`.
2. Reuse `runStepReview({ reviewType: "code" })` with engine journal context (same path as SP-192 final honor/spawn).
3. Honor existing worker `review.completed` code verdict in journal/artifacts when present (mirror `findCompletedFinalReview` pattern or extend helper).
4. REVISE/REPLAN loop: re-invoke worker on REVISE (match final review rework pattern).

## Dependencies

- **Task:** SP-194
- **Task:** SP-151

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs` — `runTaskOnLane`, `runFinalReviewPhase`
- `src/batch/review.mjs` — `runStepReview`, `isReviewTypeRequired`
- `tests/batch/final-verdict.test.mjs`, `tests/batch/final-review-honor.test.mjs`
- `spine-tasks/SP-190-rel-handoff-autowrite/PROMPT.md` (RL2 reference task)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub tests)

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/review.mjs`
- `tests/batch/engine-code-review.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Map current RL1 plan review flow (worker vs engine) for SP-190 batch journal
- [ ] Define engine insertion point between worker and final review

### Step 1: Engine code review phase

> **Plan-review checkpoint**

- [ ] Implement phase + journal events (`review.started` / `review.completed` for `code`)
- [ ] Skip when RL < 2 or honored artifact exists

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] RL2 stub task: engine runs code review without worker nested spawn
- [ ] RL0/1 regression unchanged
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Update findings.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] RL≥2 tasks never require worker-side code reviewer pi spawn
- [ ] SP-190 retry path completes through engine code + final review

## Git Commit Convention

- `feat(SP-195): complete Step N — description`

## Do NOT

- Remove worker plan review for RL1 unless separately specified
- Disable `requireFinalVerdict`
