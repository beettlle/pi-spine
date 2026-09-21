# SP-762: Post-DONE plan_review_spawn_failed classification — Status

**Current Step:** Step 3 (Documentation & Delivery)
**Status:** 🟣 Steps 1–2 complete — verification green
**Last Updated:** 2026-09-21
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Trace plan-review spawnFailed after doneInLane
- [x] Compare with SP-718 pattern
- [x] Dependencies satisfied (none)

### Step 1: Classification + diagnose
**Status:** ✅ Complete

- [x] Post-DONE spawnFailed not forced retry
- [x] Diagnose prefers salvage/land-loop
- [x] Regression test for #291

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand
- [x] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| spawnFailed path: `review-poll.mjs` → `recordPlanReviewTaskFailure` (review-plan.mjs) sets status=failed + exitReason=`plan_review_spawn_failed`; no artifact | Traced; exit reason already distinct — no engine change needed | `src/batch/engine-lanes/review-poll.mjs`, `review-plan.mjs` |
| `REVIEW_SPAWN_FAILURE_EXIT_REASONS` (diagnosis.mjs) omits `plan_review_*`, so headline falls through to "worker died … retry or abort" and suggestedCommand `spine batch retry <id>` (#291 root cause) | Fixed via diagnosis mapping, not headline patch | `src/batch/diagnosis.mjs` (read-only), `reconcile-diagnosis.mjs` |
| Salvage eligibility for plan_review_spawn_failed + doneInLane already works post-SP-718 (`classifyTaskDoneSemantics` in listSalvageableLanes; exit reason not in `NON_SALVAGEABLE_EXIT_REASONS`); salvage hard-gates on countCommitsAhead and fails gracefully (`lane_not_salvageable`) | Reuse existing salvage path | `src/batch/salvage-batch-list.mjs`, `salvage-batch-integrate.mjs` |
| #291 real journal has NO `lane.committed` event (worker committed to lane branch directly; engine commit phase never ran) — lane-commit evidence must not be required from journal | Gate diagnosis on done evidence (`.DONE` in lane worktree → doneInLane) instead | `src/batch/diagnosis-task-done.mjs` |
| Flipping task classification to terminal-success for this case would suppress `hasFailedTasks` and drop diagnosis into limbo_stale/needs_merge paths that hide salvage guidance — worse outcome | Keep terminal-failure; fix at deriveDiagnosis layer (SP-763 owns post-salvage complete) | `src/batch/reconcile-classify.mjs` |
| Reuse existing diagnosis id `pending_lane_land`: headline "has lane work not on main (taskId) — salvage integrate", suggestedCommand `spine batch salvage --batch X --lane N --integrate`, alternatives include dry-run — zero changes to out-of-scope taxonomy/headline/suggested-command modules | Chosen design | `src/batch/diagnosis-pending-lane.mjs` |
| `parseSpineBatchState.normalizeTasks` drops `exitReason` from parsed batch tasks — helper must resolve exit reason via `resolvePrimaryFailureExitReason` (raw state → journal), with classified entry's own `exitReason` taking precedence (unit signals) | Implemented | `src/batch/readers/spine-state.mjs`, `reconcile-diagnosis.mjs` |
| 37 tests/batch failures (startBatch/attached/detached/sequence CLI-subprocess tests) fail identically on stashed base — pre-existing lane environment issue, not caused by this change | Documented; not in scope | `tests/batch/*start*.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 preflight | Traced spawnFailed path + SP-718 comparison; blast radius: deriveDiagnosis 1 prod caller (reconcileBatch) + 3 test callers, LOW risk; gitnexus impact run |

---

## Blockers

*None*

---

## Notes

- Step 0 trace: needs_retry copy for `plan_review_spawn_failed` originates because `deriveDiagnosis` failed-branch fallback ignores done evidence; fix = new branch mapping post-DONE plan-review spawn/timeout failures to `pending_lane_land` (salvage/land-loop guidance).
