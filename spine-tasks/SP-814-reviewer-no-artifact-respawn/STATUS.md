# SP-814: Reviewer no-artifact re-spawn + logs — Status

**Current Step:** Step 5: Documentation & Delivery
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
**Status:** ✅ Complete

- [x] Output capture
- [x] Log helpers

### Step 2: Re-spawn + diagnostics
**Status:** ✅ Complete

- [x] One re-spawn
- [x] Failure diagnostics

### Step 3: Tests
**Status:** ✅ Complete

- [x] Recover on attempt 2
- [x] Both fail
- [x] Timeout / non-zero cases

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Batch suite
- [x] Coverage gate
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** 🟨 In Progress

- [x] Discoveries logged in STATUS.md
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
| 7 | Flake fix: timeout no-respawn test used a 300 ms spawn budget — under full-suite parallel load the node fake-pi child was SIGTERM'd before startup, so the invocation count never incremented. Raised to 4000 ms. |
| 8 | Arch guard (`tests/arch/ts-nocheck-guard.test.mjs`) rejects `@ts-nocheck` on new files; `reviewer-output.mjs` is typed via a `ReviewerSpawnResult` JSDoc typedef instead (no allowlist entry added). |
| 9 | Pre-existing (base 005287ee, verified via scratch worktree): `coverage:check` aborts with the same 26 timing-sensitive subprocess tests (startBatch/adoption/attached-CLI) on base and lane — byte-identical failure sets; they pass uninstrumented. `sequence-detached-poll` hard-cap/reused-PID tests also flake on base. Neither is caused by SP-814. |

## Blockers

_None._
