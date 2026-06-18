# Task: SP-279 — Engine final-review stall recovery

**Created:** 2026-06-17
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Engine reliability — hung `review.started` without terminal event blocks entire multi-lane batch.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #2**: batch `20260617T164948` stalled ~48+ minutes after workers wrote `.DONE` in lane worktrees. Journal froze on SP-269 `review.started` (final) with no `review.completed`; batch-state kept four tasks `running` and pending tasks (SP-272/276/277) never started.

**Required behavior:**
1. Engine final/code review spawn must **not hang indefinitely** — enforce configurable timeout aligned with `stallTimeoutMinutes` / reviewer spawn budget.
2. On timeout: journal `review.failed` with `reason: review_timeout`, recover lane (fail task or retry per existing REVISE policy), and **do not wedge** other lanes / pending tasks.
3. Extend `tests/batch/engine-review-orphan.test.mjs` or add fixture test using journal patterns from batch `20260617T164948`.

**Closes:** [#2](https://github.com/beettlle/pi-spine/issues/2)

## Dependencies

- **Task:** SP-278 (both touch `src/batch/review.mjs`; land SP-278 first)

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-203-engine-review-orphan-recovery/PROMPT.md`
- `src/batch/engine-lanes/review.mjs` — `runFinalReviewPhase`, `runEngineFinalReview`
- `src/batch/review.mjs` — `spawnReviewerPi`, `runStepReview`
- `tests/batch/engine-review-orphan.test.mjs`
- GitHub issue #2 body; journal `.spine/runtime/20260617T164948/journal/events.jsonl`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub / fixture tests)

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/batch/review.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/engine-final-review-timeout.test.mjs` (new)
- `tests/batch/engine-review-orphan.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/review.mjs, tests/batch/engine-final-review-timeout.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/engine-final-review-timeout.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reconstruct SP-269 stall timeline from issue #2 journal (final `review.started` @ 17:18:04, freeze until recovery)
- [ ] Identify whether stall is spawn hang, lane serialization, or engine PID wedged

### Step 1: Review spawn timeout + recovery

> **Plan-review checkpoint**

- [ ] Add bounded timeout to `spawnReviewerPi` (or wrapper used by engine final/code phases) with fail-closed terminal journal event
- [ ] Ensure `runFinalReviewPhase` returns `{ ok: false }` on timeout so task/lane can fail or retry — not infinite `running`
- [ ] Verify multi-lane wave: one lane's hung review does not prevent other lanes' pending tasks from scheduling (if currently coupled, decouple)

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Fixture/stub test: simulated hung spawn → timeout → terminal `review.failed` + task not stuck `running` forever
- [ ] Extend orphan recovery tests if resume path needs timeout honor
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Add operator-runbook troubleshooting entry for final-review timeout (symptoms + recovery)
- [ ] Close GitHub issue #2: `gh issue close 2 --comment "Fixed in SP-279: engine review spawn timeout + recovery; multi-lane batch no longer wedges on hung final review."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — final review stall / timeout

**Check If Affected:**
- `spine-tasks/_explore/reliability-epic/findings.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #2 closed with comment referencing SP-279
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-279): complete Step N — description`
- `fix(SP-279): description`
- `test(SP-279): description`

## Do NOT

- Change worker `spine_review_step` skip semantics (SP-278)
- Remove SP-203 orphan kill on resume — extend, don't regress
- Lower coverage below 77%

---

## Amendments (Added During Execution)
