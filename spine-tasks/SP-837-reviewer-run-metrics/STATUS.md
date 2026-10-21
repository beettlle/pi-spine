# SP-837: Reviewer rows in run-metrics (model, verdict, attempts) — Status

**Current Step:** Step 4: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `runReviewPollLoop`, `buildTaskMetricRecord`, `rollupMetrics`, `buildQuotaSnapshot`
- [x] `rg -n 'recordType' src tests` — record every reader that filters on it

### Step 1: Builder + emit points
**Status:** ✅ Complete

- [x] `buildReviewMetricRecord` / `appendReviewMetric`
- [x] Rows on every verdict and reviewer failure; `finalVerdict` set

### Step 2: Readers
**Status:** ✅ Complete

- [x] `reviews` rollup in `metrics show` (table + `--json`)
- [x] Quota snapshot counts reviewer models

### Step 3: Tests
**Status:** ✅ Complete

- [x] Stub verdicts REVISE,PASS per review type → two rows, attempts 1 and 2, model/thinking from a profile-resolved config where worker and reviewer differ
- [x] Spawn failure row
- [x] Rollup groups by `(reviewType, model)`; old records without new fields still read
- [x] Quota snapshot `observedModels` includes the reviewer model; `drift.missingModels` no longer lists it

### Step 4: Testing & Verification
**Status:** 🟨 In Progress

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-837-reviewer-run-metrics/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `recordType` readers: `src/metrics/quota-snapshot.mjs` (task → now task+review), `src/doctor/quota-risk.mjs` and `src/dashboard/lane-throughput.mjs` (task only, unchanged), `src/batch/metrics.mjs` table (type column), `tests/**` task filters | Reviewed; only quota-snapshot widened | Step 0 |
| `review.blocked` is journaled by `applyTaskReviewProfile`, not the poll loop; blocked rows are emitted there (one per blocking review type, no `attempt`/`verdict`) | Emitted at the engine call site; `task-agent-profile.mjs` touched though outside File Scope | `src/batch/engine-lanes/task-agent-profile.mjs` |
| Honored-artifact fast path (`honorCompletedReview`) emits no review row: no reviewer ran, and the original verdict already produced a row (or the journal event) | Intentionally not recorded | `src/batch/engine-lanes/review-poll.mjs` |
| `finalVerdict` set on PASS (honored + poll), and on REVISE/REPLAN/invalid via `recordFinalReviewTaskFailure` (exhaustion path) | Done | `src/batch/engine-lanes/review-final.mjs` |
| Quota pool usage: reviewer rows add `durationMs`/tokens but not `taskCount`; new optional `usage.reviewCount` (only when > 0); `spine metrics quota` prints `N reviews` | Added `quota-cli.mjs` one-liner (outside File Scope) | `src/metrics/quota-snapshot.mjs`, `src/metrics/quota-cli.mjs` |
| `rollupMetrics` now returns `{..., reviews}` and is non-null when only review rows exist; `rollupReviews` exported | Done | `src/batch/metrics-rollup.mjs` |
| `profile` on review rows is supported by the builder but not populated: per-task review config carries only model/thinking pins | Left unset | `src/batch/metrics.mjs` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
