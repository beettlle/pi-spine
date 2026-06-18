# Task: SP-285 — Engine reviewer nested spawn env fix

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Review regression — engine-owned plan review fails `nested_spawn_blocked` because `SPINE_WORKER_RUNNER` leaks into reviewer spawn from parent engine process.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #8**: after SP-267 worker completed in batch `20260618T191236`, engine plan review immediately failed with `nested_spawn_blocked` — the guard meant for in-worker `spine_review_step` (SP-195/SP-278), not engine-owned reviews.

**Root cause (suspected):** `spawnReviewerPi` checks `process.env.SPINE_WORKER_RUNNER` on the engine process; worker child env leaks via inheritance.

**Required behavior:**
1. Engine reviewer spawn must **not** inherit `SPINE_WORKER_RUNNER` (unset or strip in reviewer child `env`).
2. In-worker nested guard remains fail-closed for worker sessions.
3. Extend `nested-reviewer-guard.test.mjs` with engine-path fixture (engine process has marker, reviewer child does not).

**Closes:** [#8](https://github.com/beettlle/pi-spine/issues/8)

## Dependencies

- **Task:** SP-268

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `src/batch/review-spawn.mjs` — `isActiveWorkerSession`, `spawnReviewerPi`
- `src/batch/worker-host.mjs` — `SPINE_WORKER_RUNNER` set on worker child
- `tests/batch/nested-reviewer-guard.test.mjs`
- `spine-tasks/SP-278-worker-review-step-delegate/PROMPT.md`
- GitHub issue #8; journal `.spine/runtime/20260618T191236/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/review-spawn.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs`
- `tests/batch/review-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/review-spawn.mjs, tests/batch/nested-reviewer-guard.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/nested-reviewer-guard.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Confirm `spawnReviewerPi` spreads `process.env` including `SPINE_WORKER_RUNNER` on engine
- [ ] Reproduce failure mode in unit test (engine env has marker → blocked)

### Step 1: Strip worker marker from reviewer child env

> **Plan-review checkpoint**

- [ ] Reviewer spawn `env` omits `SPINE_WORKER_RUNNER` (delete key explicitly)
- [ ] `isActiveWorkerSession()` still blocks when called inside actual worker child process
- [ ] No change to SP-278 worker-tool skip semantics

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] `nested-reviewer-guard.test.mjs`: engine parent with marker spawns reviewer successfully
- [ ] Worker session still blocked for nested spawn
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Close GitHub issue #8: `gh issue close 8 --comment "Fixed in SP-285: reviewer pi spawn strips SPINE_WORKER_RUNNER; engine plan/code/final reviews no longer hit nested_spawn_blocked."`
- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if operator-facing symptoms documented

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #8 closed with comment referencing SP-285
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-285): complete Step N — description`
- `fix(SP-285): description`
- `test(SP-285): description`

## Do NOT

- Remove nested guard for in-worker `spine_review_step` calls
- Set `SPINE_WORKER_RUNNER` on reviewer children

---

## Amendments (Added During Execution)
