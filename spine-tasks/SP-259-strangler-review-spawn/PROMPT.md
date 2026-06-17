# Task: SP-259 — Strangler extract review spawn module

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** First strangler slice moving reviewer pi spawn out of god-file `review.mjs`; depends on dedup landing first.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract reviewer spawn logic (`spawnReviewerPi`, related argv/env assembly) from `src/batch/review.mjs` into `src/batch/review-spawn.mjs`. `review.mjs` becomes a thinner coordinator. Behavior and FR-REV spawn contract unchanged.

## Dependencies

- **Task:** SP-258 (shared dedup landed — reduces merge conflict risk)

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

- `src/batch/review.mjs` — `spawnReviewerPi` and callers
- `src/batch/review-shared.mjs` — from SP-258
- `tests/batch/nested-reviewer-guard.test.mjs` — nested spawn guard

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-spawn.mjs`
- `src/batch/review.mjs`
- `tests/batch/review-spawn.test.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review-spawn.mjs`, `src/batch/review.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `src/batch/review-spawn.mjs`, `tests/batch/review-spawn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-258 complete (review-shared.mjs exists)
- [ ] Identify `spawnReviewerPi` and tightly coupled helpers to move
- [ ] Baseline: `npm test -- tests/batch/nested-reviewer-guard.test.mjs`

### Step 1: Extract review-spawn module
> **Plan-review checkpoint**

- [ ] Create `src/batch/review-spawn.mjs` with `spawnReviewerPi` (and minimal private helpers)
- [ ] `review.mjs` imports and delegates — no duplicate spawn logic left
- [ ] Preserve model/thinking argv, timeout, nested-reviewer guard, `SPINE_REVIEW_TEST_NO_PI`
- [ ] Call `spine_review_step` after step

### Step 2: Tests
> **Code review checkpoint**

- [ ] Add `tests/batch/review-spawn.test.mjs` — argv includes `--model` when config pins reviewer; missing pi fails closed
- [ ] Nested-reviewer guard tests still pass
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Record `review.mjs` line count before/after in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/EXECUTION-FLOW.md` — review spawn module name

## Completion Criteria

- [ ] `review-spawn.mjs` owns pi reviewer spawn; `review.mjs` has no inline spawn implementation
- [ ] All review spawn tests pass
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-259): complete Step N — description`
- `refactor(SP-259): description`
- `test(SP-259): description`

## Do NOT

- Further dedupe engine-lanes (SP-258 scope)
- Change reviewer model pin semantics
- Split verdict parsing in this task (future slice)

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-267, SP-268.

