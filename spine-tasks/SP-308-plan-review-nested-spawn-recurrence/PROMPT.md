# Task: SP-308 — Plan review nested_spawn recurrence fix

**Created:** 2026-06-19
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Batch reliability regression — in-worker plan checkpoint journals `review.failed` / `nested_spawn_blocked` and orphans the lane worker despite SP-278/SP-285.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #12**: batch `20260619T020951` — **SP-306** plan review at step 0 failed with `nested_spawn_blocked`, worker orphaned for ~14h until manual resume.

**Required behavior:**
1. In-worker plan checkpoint (`spine_review_step` / worker tool path) must journal `review.skipped` (not `review.failed`) and let the worker continue (SP-278 contract).
2. Batch engine must use repo-local spine (`node bin/spine.mjs` or linked package) — preflight/doctor should block or warn when PATH `spine` version ≠ package (stale v1.0.1 suspected).
3. Add regression test reproducing batch `20260619T020951` journal pattern (plan review immediate `nested_spawn_blocked`).
4. Orphan diagnosis after plan `review.failed` should surface actionable retry (`batch retry SP-306`) without silent stall.

**Closes:** [#12](https://github.com/beettlle/pi-spine/issues/12)

## Dependencies

- **Task:** SP-285

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `src/batch/review.mjs` — `runStepReview`, `shouldBlockNestedReviewerSpawn`
- `src/batch/review-spawn.mjs` — `buildReviewerChildEnv`, nested guard
- `tests/batch/nested-reviewer-guard.test.mjs`
- `src/batch/worker-host.mjs` — worker spawn env
- `src/doctor/` — stale PATH spine check
- GitHub issue #12; journal `.spine/runtime/20260619T020951/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/review.mjs`
- `src/batch/review-spawn.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs`
- `src/doctor/` (stale PATH spine guard — if in scope for fix)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/review.mjs, tests/batch/nested-reviewer-guard.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/nested-reviewer-guard.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reconstruct SP-306 timeline from issue #12 journal
- [ ] Confirm whether failure path is worker tool vs engine-owned review
- [ ] Check if global PATH `spine` version mismatch explains `review.failed` vs `review.skipped`

### Step 1: Fix nested plan checkpoint handling

> **Plan-review checkpoint**

- [ ] Ensure plan checkpoint in worker session always returns skip (exit 0), never `review.failed` for `nested_spawn_blocked`
- [ ] If engine env leak (`SPINE_WORKER_RUNNER` + `SPINE_TASK_FOLDER`), strip or narrow `shouldBlockNestedReviewerSpawn` for engine-owned reviews only
- [ ] Preflight or doctor fails when PATH `spine` ≠ package version (or document `npm link` requirement)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Extend `nested-reviewer-guard.test.mjs` with plan-review worker-session fixture from batch `20260619T020951`
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Update operator-runbook — stale PATH spine, plan nested_spawn symptoms, retry guidance
- [ ] Close GitHub issue #12: `gh issue close 12 --comment "Fixed in SP-308: plan checkpoint nested_spawn journals skip; stale PATH spine guarded."`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Plan checkpoint nested guard never journals `review.failed` for expected in-worker skip
- [ ] Regression test from issue #12 journal pattern
- [ ] Issue #12 closed
- [ ] `.DONE` created

## Git Commit Convention

- `fix(SP-308): description`
- `test(SP-308): description`

## Do NOT

- Remove SP-195 engine-owned review delegation
- Re-enable nested reviewer spawn inside worker sessions
