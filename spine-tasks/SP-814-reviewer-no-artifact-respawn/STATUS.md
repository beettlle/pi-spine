# SP-814: Reviewer no-artifact re-spawn + logs — Status

**Current Step:** Step 1: Capture + reviewer log
**Status:** 🟨 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Timeout / nested branches confirmed
- [x] Dependencies satisfied

### Step 1: Capture + reviewer log
**Status:** 🟨 In Progress

- [ ] Output capture
- [ ] Log helpers

### Step 2: Re-spawn + diagnostics
**Status:** ⬜ Not Started

- [ ] One re-spawn
- [ ] Failure diagnostics

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Recover on attempt 2
- [ ] Both fail
- [ ] Timeout / non-zero cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact: `spawnReviewerPi` LOW (sole runtime caller `runStepReview`); `runStepReview` LOW (3 direct callers: `runEnginePlanReview` / `runEngineCodeReview` / `runEngineFinalReview` via `runEngineReview`). Result-shape changes must stay additive. |
| 2 | Timeout branch: `review-spawn.mjs` timer → exit 124 + `reason: review_timeout`; `honorReviewSpawnFailureWhenEligible` honors only when `.DONE` exists; `review-poll.mjs:284` classifies `${type}_review_timeout` from `reason` — retry must never fire for 124/`review_timeout`. |
| 3 | Nested guard: pre-spawn `shouldBlockNestedReviewerSpawn()` → `completeNestedReviewSpawnSkipped` (`review.skipped`); defensive `spawnResult.reason === nested_spawn_blocked` check at `review-step-run.mjs:238` — both must stay outside the retry rule. |
| 4 | `result.exitCode` consumers: `bin/spine-review-step.mjs` maps it to CLI exit; `extensions/spine/worker-tools.ts` sets `isError: exitCode !== 0 && !skipped`. The returned result must keep a non-zero exit code on failure; the reviewer's real exit code (e.g. 0) goes into the `review.failed` payload only. |
| 5 | `writeTextAtomic` already `mkdirSync(dir, { recursive: true })` — reviewer log needs no pre mkdir. No import cycle: `worker-output.mjs` → journal/atomic-write/secret-redact only. |
| 6 | `appendJournalEvent` redacts + caps payloads; new `review.spawn_retry` event type is ignored by `macro-phase` (only started/completed/failed matter), `hasReviewSpawnFailureForHonor` (failed/completed), and `detectOrphanedReviewStarted`. |

## Blockers

_None._
