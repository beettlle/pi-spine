# Task: SP-192 — Engine honors worker final review

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** Fixes real-pi E2E false `final_review_spawn_failed` when worker already ran final review (SP-150/151 gap).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Close the Phase 20b integration gap: when a real `pi` worker completes final review via `spine_review_step --type final` (journal `review.completed` with `verdict: PASS` and `.reviews/final-*.md`), the engine must **not** fail with `final_review_spawn_failed`. Either honor the existing artifact/journal or spawn final review from the engine using the real `spine review step` path (not stub-only).

**Incident:** Real-pi adoption E2E batch `20260611T220521` — worker wrote `.DONE` and `REAL-PI-SMOKE.txt`, journal shows final **PASS**, engine recorded `task.failed` / `final_review_spawn_failed`.

**Source:** Phase 20b SP-150 (worker final spawn) + SP-151 (engine final phase); [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-151
- **Task:** SP-179

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs` — `runFinalReviewPhase`, `runEngineFinalReview`
- `src/batch/review.mjs` — `buildFinalReviewArtifactPath`, `parseReviewVerdict`, spawn helpers
- `tests/batch/final-verdict.test.mjs`
- `tests/fixtures/adoption-repo/taskplane-tasks/AD-002-real-pi-smoke/PROMPT.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub tests); optional manual `./scripts/real-pi-adoption-e2e.sh --batch`

## File Scope

- `src/batch/engine-lanes.mjs`
- `src/batch/review.mjs`
- `tests/batch/final-verdict.test.mjs`
- `tests/batch/final-review-honor.test.mjs` (new, if cleaner than extending final-verdict)

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

- [ ] Read `runEngineFinalReview` stub-only branch (lines ~556–567 in `engine-lanes.mjs`)
- [ ] Reproduce failure mode: worker journal has `review.completed` final PASS → engine must not call `recordFinalReviewTaskFailure` with `final_review_spawn_failed`

### Step 1: Detect existing worker final review

> **Plan-review checkpoint**

- [ ] Add helper (e.g. `findCompletedFinalReview`) that checks journal tail and/or latest `.reviews/final-*.md` for `PASS`
- [ ] `runFinalReviewPhase` uses helper before `runEngineFinalReview`; on PASS → return `{ ok: true, verdict: "PASS", honored: true }`

### Step 2: Real-pi engine spawn fallback

> **Code review checkpoint**

- [ ] When no honored artifact exists and not stub mode, spawn `spine review step --type final` from engine (reuse `review.mjs` spawn path from SP-150) instead of `spawnFailed: true`
- [ ] Preserve REVISE/REPLAN loop and `maxFinalAttempts` behavior from SP-152/153

### Step 3: Testing & Verification

- [ ] Unit test: pre-seeded `review.completed` final PASS → `runFinalReviewPhase` succeeds without `final_review_spawn_failed`
- [ ] Regression: existing `final-verdict.test.mjs` stub paths still pass
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code
- [ ] Optional sign-off: `unset SPINE_WORKER_STUB && ./scripts/real-pi-adoption-e2e.sh --batch` reaches `.DONE` without batch failure

### Step 4: Documentation & Delivery

- [ ] Note fix in `spine-tasks/_explore/reliability-epic/findings.md` (open questions → resolved)
- [ ] Create `.DONE` when complete

## Completion Criteria

- [ ] Real-pi adoption AD-002 batch completes with `task.completed` (not `final_review_spawn_failed`) when worker runs final review
- [ ] Stub final-verdict tests remain green
- [ ] No duplicate final review spawn when artifact already PASS

## Git Commit Convention

- `feat(SP-192): complete Step N — description`

## Do NOT

- Disable `requireFinalVerdict` globally to paper over the bug
- Change worker PROMPT to skip final review
