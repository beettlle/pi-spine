# SP-837: Reviewer rows in run-metrics (model, verdict, attempts) — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `runReviewPollLoop`, `buildTaskMetricRecord`, `rollupMetrics`, `buildQuotaSnapshot`
- [ ] `rg -n 'recordType' src tests` — record every reader that filters on it

### Step 1: Builder + emit points
**Status:** ⬜ Not Started

- [ ] `buildReviewMetricRecord` / `appendReviewMetric`
- [ ] Rows on every verdict and reviewer failure; `finalVerdict` set

### Step 2: Readers
**Status:** ⬜ Not Started

- [ ] `reviews` rollup in `metrics show` (table + `--json`)
- [ ] Quota snapshot counts reviewer models

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Stub verdicts REVISE,PASS per review type → two rows, attempts 1 and 2, model/thinking from a profile-resolved config where worker and reviewer differ
- [ ] Spawn failure row
- [ ] Rollup groups by `(reviewType, model)`; old records without new fields still read
- [ ] Quota snapshot `observedModels` includes the reviewer model; `drift.missingModels` no longer lists it

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

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

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
