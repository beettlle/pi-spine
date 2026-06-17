# Task: SP-258 — Deduplicate engine-lanes review overlap

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Extract ~470 lines of duplicated logic between `engine-lanes/review.mjs` and `review.mjs` into a shared module; moderate blast radius in batch review path.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Reduce duplication between `src/batch/engine-lanes/review.mjs` and `src/batch/review.mjs` by extracting shared review helpers into `src/batch/review-shared.mjs`. Behavior must remain identical — this is a strangler-fig dedup slice, not a behavior change.

## Dependencies

- **None**

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

- `src/batch/engine-lanes/review.mjs` — lane review phase wiring
- `src/batch/review.mjs` — core review spawn and verdict parsing
- `spine-tasks/SP-210-ship-engine-lanes-review/PROMPT.md` — prior extraction context

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-shared.mjs`
- `src/batch/engine-lanes/review.mjs`
- `src/batch/review.mjs`
- `tests/batch/review-shared.test.mjs`
- `tests/batch/engine-code-review.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review-shared.mjs`, `src/batch/engine-lanes/review.mjs` |
| fileScopeMustNotChange | `src/batch/worker-host.mjs`, `bin/spine-worker-runner.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `src/batch/review-shared.mjs` |

## Steps

### Step 0: Preflight

- [ ] Diff `engine-lanes/review.mjs` vs `review.mjs` — list duplicated functions/blocks
- [ ] Run `npm test -- tests/batch/engine-code-review.test.mjs` — baseline green

### Step 1: Extract shared module
> **Plan-review checkpoint**

- [ ] Create `src/batch/review-shared.mjs` with extracted helpers (name functions clearly)
- [ ] Update `engine-lanes/review.mjs` to import from `review-shared.mjs`
- [ ] Update `review.mjs` to import same helpers — remove duplicated blocks
- [ ] No behavior change — pure move/refactor
- [ ] Call `spine_review_step` after step

### Step 2: Tests and line-count check
> **Code review checkpoint**

- [ ] Add targeted tests for any newly exported pure helpers in `review-shared.mjs`
- [ ] Confirm `engine-lanes/review.mjs` line count drops materially (target: ≥200 lines removed or documented in STATUS)
- [ ] Existing engine-code-review tests still pass
- [ ] Call `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Log extracted symbols and remaining duplication debt in STATUS.md for SP-259
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/EXECUTION-FLOW.md` — only if review phase module names change in prose

## Completion Criteria

- [ ] Shared module exists; both review files import it
- [ ] No duplicate blocks ≥30 lines between engine-lanes/review.mjs and review.mjs for extracted concerns
- [ ] Full suite and coverage gate ≥77%

## Git Commit Convention

- `feat(SP-258): complete Step N — description`
- `refactor(SP-258): description`
- `test(SP-258): description`

## Do NOT

- Extract review spawn into separate module (SP-259)
- Change review verdict contract or nested-reviewer guard behavior
- Fix commandExists (SP-256) in same task

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-265, SP-266.

