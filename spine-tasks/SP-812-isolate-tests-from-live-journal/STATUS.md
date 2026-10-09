# SP-812: Isolate test and worker commands from the live journal — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] CLI final-review callers checked
- [x] Dependencies satisfied

### Step 1: CLI guard + helper
**Status:** ✅ Complete

- [x] Plan/code-only env journal
- [x] Helper

### Step 2: Test isolation + regression
**Status:** ✅ Complete

- [x] Tests isolated
- [x] Regression cases

**Artifacts:** `bin/spine-review-step.mjs`, `tests/helpers/live-journal-env.mjs` (new), `tests/batch/review.test.mjs`, `tests/batch/stub-runner-delivery.test.mjs`, `tests/batch/worker-runner-done-missing.test.mjs`

### Step 3: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Attach-env re-run leaves no journal
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Preflight: `rg "spine-review-step|runSpineReviewStep" src bin extensions` — engine final reviews run in-process (`src/batch/engine-lanes/review-final.mjs:100` calls `runStepReview` with explicit `journal`); `bin/spine-worker-runner.mjs:284` stub-enforce path only uses plan/code; worker tool schema (`extensions/spine/worker-tools.ts`) restricts `type` to plan/code. No engine path runs final reviews through the CLI. Guard is safe. |
| 2 | GitNexus index does not track `runSpineReviewStep` (bin/ CLI export); manual rg blast-radius used instead: 3 callers (worker-tools.ts, bin/spine.mjs:123, CLI entrypoint). Risk LOW. |
| 3 | `tests/batch/review.test.mjs:540` ("stub worker stops when enforced review spawn fails") already deletes the same live-journal keys inline — will be refactored to the new `withoutLiveJournalEnv` helper for one source of truth. |

## Plan (Review Level 1)

1. `bin/spine-review-step.mjs`: env-derived journal (`resolveBatchJournalContext()`) only for `--type plan`/`code`; `--type final` without explicit `options.journal` does not journal.
2. New `tests/helpers/live-journal-env.mjs`: `LIVE_JOURNAL_ENV_KEYS` + `withoutLiveJournalEnv(env)`.
3. Isolate three tests: `review.test.mjs` final-CLI test (save/clear/restore keys), `stub-runner-delivery.test.mjs` spawn env, `worker-runner-done-missing.test.mjs` two spawn envs.
4. Regression test in `review.test.mjs`: attach env + no `journal` → `--type final` writes no journal file; `--type plan` still journals.

## Blockers

_None._
