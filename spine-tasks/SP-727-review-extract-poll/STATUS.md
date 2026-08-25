# SP-727: Extract review-poll.mjs from review.mjs — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-25
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: Extract poll helper

**Status:** ✅ Complete

Plan: extract the shared mechanics of the three `while(true)` poll loops (plan/code/final) into `src/batch/engine-lanes/review-poll.mjs`:
- `removeDoneFile` + `appendReviewHonorJournalEvents` (moved as-is)
- `honorCompletedReview` — generic honor fast-path (parameterized by reviewType/passVerdict/attemptKey)
- `runReviewPollLoop` — generic poll loop with injected `runEngineReview`, `recordReviewTaskFailure`, and optional `beforeReview` hook (final phase contract verify)
`review.mjs` keeps gates, caps, stub verdicts, record*Failure fns, and wires the helpers. No signature changes to exported phase fns.

- [x] Move shared poll-loop logic into `review-poll.mjs`
- [x] Wire `review.mjs` to import without behavior change

## Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only — `npm run typecheck` clean; `tests/batch/final-verdict.test.mjs` 11/11 pass (incl. REVISE rework, SP-725 caps, needs_replan)
- [x] Fix all failures from the scoped contract command — none

## Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| 2026-08-25 | 1 | plan | skipped (real-pi session; engine reviews after .DONE, SP-195) |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1-2 complete | review-poll.mjs extracted (427 lines); review.mjs 1552→897 lines; contract testCommand green; commit 54191cf9 |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes

- GitNexus `impact`/`query` tools truncated string params in this session; blast radius verified manually via grep: phase fns imported by `engine-lanes.mjs`, `resume-lane-reviews.mjs`, and 2 test files — signatures unchanged, no caller edits needed. `detect_changes` post-edit confirmed only expected symbols touched.
