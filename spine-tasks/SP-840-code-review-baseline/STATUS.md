# SP-840: Engine code review diffs against the task start commit — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-10-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `runCodeReviewPhase`, `runEngineCodeReview`, `resolveTaskStartCommit`
- [x] Confirm `src/batch/journal.mjs` registration pattern (SP-834/835 also add events there — append only)

### Step 1: Validator + wiring
**Status:** ✅ Complete

- [x] `isValidCommitSha`; invalid start commits resolve to `null`
- [x] Code review receives `baseline`; `review.baseline_missing` when unresolved

### Step 2: Tests
**Status:** ✅ Complete

- [x] Committed step work with a clean tree: review request contains `git diff <sha>..HEAD`; scope paths non-empty
- [x] `--evil` / non-hex start commit rejected → `review.baseline_missing`
- [x] Validator table

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-840-code-review-baseline/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `src/batch/journal.mjs` has no event registry; "registering" `review.baseline_missing` = adding it to the diagnosis-hint priority list (append-only, file stays at 499 LOC). | Done | `src/batch/journal.mjs` |
| `runCodeReviewPhase` impact is HIGH (callers: `runNonMatrixTaskOnLane`, `runLaneReviewPhasesBeforeCommit`); change is additive, stub path unaffected. | Noted | `review-code.mjs` |
| Contract stet run flagged 6 findings, all in SP-838 files (`provider-quota.mjs`, `provider-quota.test.mjs`, `reviewer-provider-error.test.mjs`), not this diff; one claim (`ZAI_1308` undefined) is false. Dismissed `out_of_scope`. | Dismissed | stet |
| Test command sets `SPINE_WORKER_STUB=1`; the new test clears it and uses a fake `pi` on PATH to exercise the real review path. | Noted | `tests/batch/review-code-baseline.test.mjs` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-18 | Implemented validator, wiring, tests; Contract testCommand (lint, typecheck, 5 test files, stet) green | Done |
