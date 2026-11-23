# SP-884: Fix live run-metrics tokensIn/tokensOut — Status

**Current Step:** Step 3 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Trace worker sidecar write → queue read → metric row
- [x] Trace reviewer usage → buildReviewMetricRecord emit
- [x] Compare fixture JSON shapes to current pi --mode json samples

---

### Step 1: Fix live usage plumbing
**Status:** ✅ Complete

- [x] Repair worker and/or reviewer path
- [x] Preserve omit-when-absent
- [x] Keep #380 sidecar dirty exclusions

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Extend unit/fixture coverage
- [x] Assert usage keys when provided

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract testCommand passing
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Worker sidecar chain verified correct end-to-end (runner write → `attachTaskUsageFromSidecar` → `buildTaskMetricRecord`); all 48 existing contract tests pass | No worker-path bug found | `bin/spine-worker-runner.mjs`, `src/batch/engine-lanes/queue.mjs`, `src/batch/metrics.mjs` |
| **Reviewer live drop found:** `spawnReviewerPi` computes real usage from the pi JSON stream (live-pi probe returned `{tokensIn:2696, tokensOut:81, estimatedUsd:0.006364}`), but `runStepReview` drops `spawnResult.usage` on every return path, so `runReviewPollLoop` always sees `usage: undefined` → reviewer rows stay `withUsage: 0` | Fix in Step 1 | `src/batch/review-step-run.mjs` |
| pi 1.5.2 `--mode json` shapes match `sumUsageFromPiJsonStream` assumptions — confirmed against a real `pi -p --mode json` spawn, not just fixtures | No parser change needed | `src/batch/pi-json-usage.mjs` |
| **File-scope amendment (documented, not silent):** the fix requires `src/batch/review-step-run.mjs`, not listed in PROMPT File Scope. No in-scope file can carry the fix: usage exists only inside `runStepReview` (the stream is captured in-memory by `spawnReviewerPi` and never persisted on success), and `review-poll.mjs` only consumes results. PROMPT itself anticipates emit-site drift ("review-poll.mjs (or current reviewer emit site)"). Expansion recorded here per FR-WORK-06; engine plan review adjudicates | Scope expansion + fix | `src/batch/review-step-run.mjs` |
| Matrix sub-lane workers share one `taskFolder`, so each row's runner clears + rewrites the same sidecar — matrix task rows carry only the last row's usage (pre-existing accuracy gap, out of scope here) | Noted for a future task | `src/batch/engine-lanes/matrix-run.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-22 | Step 0 preflight | Worker chain verified; reviewer drop proven with live-pi probe; scope amendment documented |
| 2026-11-22 | Step 1 fix | `runStepReview` forwards `spawnResult.usage` on all post-spawn returns (live-pi probe now returns usage); queue sidecar schema guard added |
| 2026-11-22 | Step 2 tests | 4 new tests: real-`runStepReview` APPROVE / spawn-failed / no-stream integration cases + queue schema guard; contract suite 52/52 green |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #377 follow-up to SP-878/879/880.
