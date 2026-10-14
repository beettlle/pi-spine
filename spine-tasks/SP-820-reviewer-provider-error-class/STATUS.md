# SP-820: Classify reviewer provider request errors — Status

**Current Step:** Complete — .DONE
**Status:** ✅ Finished
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] `_review_spawn_failed` consumers listed
- [x] Line counts recorded
- [x] Dependencies satisfied

### Step 1: Classifier
**Status:** ✅ Complete

- [x] Classifier + reason constant

### Step 2: Wire result and exit reason
**Status:** ✅ Complete

- [x] Result + journal payload
- [x] Exit reason mapping

### Step 3: Tests
**Status:** ✅ Complete

- [x] Classifier, stub reviewer, and mapping cases

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact `runStepReview` upstream: LOW risk, 6 impacted — direct callers `runEnginePlanReview`/`runEngineCodeReview`/`runEngineFinalReview`, then 3× `runEngineReview`. No processes affected; changes are additive payload/result fields. |
| 2 | `runReviewPhaseLoop` is not a top-level graph symbol — the loop is `runReviewPollLoop` (exported, `review-poll.mjs:257`); exit-reason mapping is the `spawnExitReason` ternary at ~line 330. |
| 3 | `_review_spawn_failed` consumers: producer `review-poll.mjs:332`; `diagnosis.mjs:106,108` (code/final classification lists); `reconcile-diagnosis.mjs:144` (plan); tests `salvage-complete-after-integrate`, `post-done-plan-review-spawn`, `salvage-final-review-spawn-failed` (fixture exit reasons). Per prompt, diagnosis consumers are SP-821's scope — noted, NOT edited; new `*_review_provider_error` reasons fall through diagnosis as generic failures (fail-closed). |
| 4 | Line counts (preflight): `review-step-run.mjs` 473, `review-poll.mjs` 496, `provider-quota.mjs` 220. Budget: ≤500 each for the first two. |
| 5 | Dependencies satisfied: SP-828 stet adoption present (`scripts/spine-stet-contract-run.sh`, `.review/config.toml`, `.review/**` in fileScopeMustNotChange). |
| 6 | Spawn-failed branch can carry `reason: review_timeout` (timeout results land there post-honor-check); nested-spawn reason returns earlier. Classifier wiring must therefore classify only when `spawnResult.reason` is unset, leaving timeout/nested paths byte-identical. |
| 7 | Non-zero-exit spawn failures are SP-814 retry-eligible → stub Gemini-400 test expects exactly 2 spawns and classification on the final attempt. |
| 9 | Export-only change to `provider-quota.mjs` (`collectStatusPayloads`) — behavior untouched, verified by 1-line diff. |
| 10 | Line caps met: `review-step-run.mjs` 485, `review-poll.mjs` 499 (≤500). Shared `providerErrorFields` helper lives in the new module to keep the wiring file under the cap. |
| 12 | Stet triage round 1 (10 findings): 8 dismissed as false_positive/out_of_scope — the import/unused-symbol/spread-order claims were all contradicted by the actual code and passing tests; the 2 real ones (payload-unscoped `markerLine` fallback; redundant test import) were fixed in b8deb92a. |
| 13 | Stet triage round 2 (2 findings, both reviewer errors): 40aec61 claimed `JSON.stringify(payload)` circular-ref TypeError — impossible for `JSON.parse` output (acyclic by construction). 414714f claimed `REVIEW_TIMEOUT_REASON` must come from review-spawn.mjs — it is also re-exported by review.mjs (line 41); the import resolves and tests pass. |
| 11 | Wiring guards classification on `spawnResult.reason` being unset, so the nested-spawn return, timeout (`review_timeout`), and honor/retry-eligibility paths are byte-identical. |
| 8 | `runReviewPollLoop` takes injectable `runEngineReview`/`recordReviewTaskFailure` → exit-reason mapping testable via DI, no processes. `shouldEmitReviewResumed([], taskId)` → false, so empty `journalEvents` is safe. |

## Blockers

_None._
