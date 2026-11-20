# SP-874: Step-0 plan review spawn ordering before later-step plan reviews — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map where step-0 vs later plan reviews are spawned
- [x] GitNexus impact on runPlanReviewPhase

---

### Step 1: Ordering fix
**Status:** ✅ Complete

- [x] Schedule step-0 plan review before later-step plan reviews
- [x] Preserve fail-closed spawn failure paths

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Assert step 0 is first when multiple plan reviews are queued

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Step-0 vs later-step plan review spawn sites mapped: engine post-.DONE plan phase (`runPlanReviewPhase` → `runEnginePlanReview` → `runStepReview` spawn) targets `findPlanReviewStepNumber` = first `plan-review checkpoint` marker step, else min step. Packets with a checkpoint at step N>0 queue ONLY the later-step review — step 0 is silently dropped (mission item 2 violation). | Fixed: `findPlanReviewStepOrder` queues [min step, checkpoint] | `src/batch/engine-lanes/review-plan.mjs` |
| Later-step plan verdicts enter the journal pre-phase via worker `spine_review_step` stub checkpoint reviews (stub batches); the phase-level honor scan accepted ANY plan `review.completed` for the task regardless of `payload.stepNumber`, so a later-step verdict could satisfy the gate while step 0 was unreviewed. | Fixed: step-filtered honor scan; legacy events without `stepNumber` stay honorable for the target step (engine-code-review.test.mjs "honors journal review.completed plan APPROVE" fixture depends on this) | `findCompletedPlanReview` |
| GitNexus index (pi-spine, indexed 2026-11-19T20:33 @885544be) does NOT contain `runPlanReviewPhase`/`runEnginePlanReview` — MCP + CLI impact both returned not-found (risk: UNKNOWN per AGENTS.md standing order). Confirmed callers via text search: `engine-lanes.mjs:392` (runNonMatrixTaskOnLane), `resume-lane-reviews.mjs:17` (← `resume.mjs:317`, `resume-multi-lanes.mjs:66,359`), facade re-exports only; matrix-run.mjs has no direct plan-phase call. All callers check only `.ok`. | Index gap documented; text-search confirmation per AGENTS.md UNKNOWN rule | `.gitnexus/meta.json`, grep |
| `detect_changes` (scope all) reports changed_files:1 / changed_symbols:0 — a zero means UNSEEN here (index lacks review-plan.mjs symbols), not unaffected; compensated with caller mapping above + neighbor-suite regression (87/90, same 3 pre-existing failures as clean-tree `git stash` baseline: review-run-metrics "stub REVISE then pass", "final REVISE exhaustion", "blocked reviewer pairing" — reviewer-pairing metrics, unrelated to plan ordering) | Pre-existing failures untouched | `tests/batch/review-run-metrics.test.mjs` |
| No existing packet shape combines step 0 + checkpoint at N>0 in tests/fixtures — ordering change is behavior-visible ONLY for the #294 packet shape; nested-reviewer-guard fixture (checkpoint at step 0), smoke fixtures (checkpoint at first step, no step 0), and no-marker packets are schedule-identical. | Regression risk confined to #294 scenario | grep over tests/fixtures + spine-tasks |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | Spawn sites mapped; GitNexus impact UNKNOWN (symbol absent from index) → text-search caller confirmation done; blast radius LOW-MED (3 call sites, `.ok`-only contracts) |
| 2026-11-20 | Step 1 ordering fix | `findPlanReviewStepOrder` schedules [step 0, checkpoint]; per-step honor scan filters foreign-step verdicts; phase loop fail-closed per step. Commit 4406f5dd |
| 2026-11-20 | Step 2 tests | `tests/batch/review-plan-phase.test.mjs` — 10 cases, all pass. Commit 099bc79f |
| 2026-11-20 | Step 3 verification | Contract testCommand exit 0 (lint ✓, typecheck ✓ after JSDoc fix, 19/19 contract tests); neighbor suites 87/90 — only the 3 pre-existing review-run-metrics failures (identical on clean tree via `git stash` baseline) |
| 2026-11-20 | Step 4 docs | operator-runbook checked — recovery flows unchanged, not affected; STATUS current; .DONE created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
