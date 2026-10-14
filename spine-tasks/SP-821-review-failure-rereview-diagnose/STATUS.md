# SP-821: Diagnose recommends re-review when a review never ran — Status

**Current Step:** Step 4: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Retry-resumes-at-review confirmed
- [x] Affected tests listed
- [x] Dependencies satisfied

### Step 1: Exit-reason set and diagnosis
**Status:** ✅ Complete

- [x] Shared set (`src/batch/diagnosis-review-infra.mjs`, 9 reasons incl. provider errors)
- [x] `needs_retry` mapping (`findPostDoneReviewInfraFailedTask`)
- [x] Pending-lane guard

### Step 2: Headline, command, alternatives
**Status:** ✅ Complete

- [x] Headline
- [x] Command + alternatives

### Step 3: Tests
**Status:** ✅ Complete

- [x] Updated tests (`post-done-plan-review-spawn.test.mjs`, `salvage-final-review-spawn-failed.test.mjs`)
- [x] New matrix test (`diagnosis-review-infra-rereview.test.mjs`)

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Retry-resumes-at-review confirmed in code: `runWorker` short-circuits when lane `.DONE` exists (`worker-host.mjs` ~L222: `return { ok: true, exitCode: 0, mode: "already-done" }`), `spine batch retry` emits `task.retry_requested` (`retry.mjs` L292), and the review poll loop emits `review.resumed` before re-spawning (`review-poll.mjs` L296-310 via `shouldEmitReviewResumed`, `review-artifacts.mjs` L338-350). Spawn-failure exits (`recordReviewTaskFailure`) never call `removeDoneFile`, so `.DONE` survives and retry re-runs only the review. No blocker. |
| 2 | SP-820 provider-error exit reasons already landed: `review-poll.mjs` L333-334 maps `REVIEW_PROVIDER_ERROR_REASON` → `` `${reviewType}_review_provider_error` `` for all three review types. |
| 3 | Impact analysis (GitNexus): `findPostDonePlanReviewSpawnFailedTask` → only caller `deriveDiagnosis` (LOW, blast radius 1). `shouldDiagnosePendingLaneLand` → no upstream edges in graph (LOW). `buildHeadline` → LOW. Both exit-reason sets are module-private today. |
| 4 | Import-cycle constraint: `reconcile-diagnosis.mjs` imports from `diagnosis.mjs`, so the shared set cannot live in `reconcile-diagnosis.mjs` (`diagnosis.mjs` needs it too — would create a cycle; `tests/arch/import-cycles.test.mjs` allowlist is empty since SP-736). Shared set + primary-exit-reason resolver move to a new leaf module `src/batch/diagnosis-review-infra.mjs`. |
| 5 | Affected tests: `tests/batch/post-done-plan-review-spawn.test.mjs` (modified), `tests/batch/salvage-final-review-spawn-failed.test.mjs` (modified), `tests/batch/diagnosis-review-infra-rereview.test.mjs` (new), plus `diagnosis*.test.mjs`, `salvage-complete-after-integrate.test.mjs`, `import-cycles.test.mjs` in the Contract command. |

## Blockers

_None._
