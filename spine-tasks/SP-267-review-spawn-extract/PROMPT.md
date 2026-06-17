# Task: SP-267 — Extract review-spawn module

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Move spawnReviewerPi from review.mjs into review-spawn.mjs.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract `spawnReviewerPi` and tightly coupled private helpers from `src/batch/review.mjs` into `src/batch/review-spawn.mjs`. Preserve model argv, timeout, nested-reviewer guard, SPINE_REVIEW_TEST_NO_PI.

## Dependencies

- **Task:** SP-266

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

```bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
```

## Context to Read First

- `src/batch/review.mjs`
- `src/batch/review-shared.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-spawn.mjs`
- `src/batch/review.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | src/batch/review-spawn.mjs, src/batch/review.mjs |
| artifactsMustExist | src/batch/review-spawn.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Identify spawnReviewerPi and coupled helpers to move
- [ ] Baseline nested-reviewer-guard tests

### Step 1: Extract module
> **Code review checkpoint**

- [ ] Create review-spawn.mjs; review.mjs delegates
- [ ] No duplicate spawn logic in review.mjs
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-267): complete Step N — description`
- `fix(SP-267): description`
- `test(SP-267): description`

## Do NOT

- Refactor unrelated review.mjs logic outside file scope
- Skip `spine_review_step` at Level 2 checkpoints

---

## Amendments (Added During Execution)
