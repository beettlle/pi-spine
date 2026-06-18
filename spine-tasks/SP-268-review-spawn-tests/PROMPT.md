# Task: SP-268 — Review-spawn tests and guard regression

**Created:** 2026-06-17
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Add review-spawn unit tests and verify nested-reviewer guard.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add `tests/batch/review-spawn.test.mjs` covering argv/model and fail-closed missing pi. Confirm nested-reviewer guard tests still pass.

**Follow-up:** Retry after batch `20260618T213001` skipped SP-268 (`review_exhausted` from plan `nested_spawn_blocked` before SP-285 landed). SP-285 is now on `main`.

**Closes:** [#9](https://github.com/beettlle/pi-spine/issues/9)

## Dependencies

- **Task:** SP-267

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

- `src/batch/review-spawn.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/review-spawn.test.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | tests/batch/review-spawn.test.mjs |
| artifactsMustExist | tests/batch/review-spawn.test.mjs |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-267 complete

### Step 1: Add tests
> **Code review checkpoint**

- [ ] review-spawn.test.mjs — argv includes --model when pinned; missing pi fails closed
- [ ] nested-reviewer-guard regression green
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Close GitHub issue #9: `gh issue close 9 --comment "Fixed in SP-268: review-spawn tests and nested-reviewer guard regression after SP-285 on main."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #9 closed with comment referencing SP-268
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-268): complete Step N — description`
- `fix(SP-268): description`
- `test(SP-268): description`

## Do NOT

- Refactor unrelated review.mjs logic outside file scope
- Skip `spine_review_step` at Level 2 checkpoints

---

## Amendments (Added During Execution)
