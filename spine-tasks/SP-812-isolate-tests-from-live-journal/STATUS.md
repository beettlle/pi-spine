# SP-812: Isolate test and worker commands from the live journal — Status

**Current Step:** Complete
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Lint — `npm run lint` exit 0 (run twice, before/after review-step-tool edit)
- [x] Contract `testCommand` — lint ✓ + typecheck ✓ + 51/51 tests exit 0
- [x] Attach-env re-run leaves no journal — contract tests run with `SPINE_JOURNAL_ATTACH=1 SPINE_BATCH_ID=x SPINE_PROJECT_ROOT=$(mktemp -d)`, no suppress var: 51/51 pass, temp root contains **zero files** (initially FAILed via `tests/worker-tools/review-step-tool.test.mjs` plan/code tool tests journaling by design; fixed by isolating them — see Discovery 4)
- [x] Coverage gate — aggregate line coverage **90.08% ≥ 77%** (extracted from `all files` reporter row). Full `npm run coverage:check` exit-0 blocked by 2 pre-existing load flakes (see Discovery 5); suite otherwise 2768-2769/2770 pass
- [x] Fix all failures — all failures caused by this change fixed; remaining failures proven pre-existing on base

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md (5 entries)
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Preflight: `rg "spine-review-step|runSpineReviewStep" src bin extensions` — engine final reviews run in-process (`src/batch/engine-lanes/review-final.mjs:100` calls `runStepReview` with explicit `journal`); `bin/spine-worker-runner.mjs:284` stub-enforce path only uses plan/code; worker tool schema (`extensions/spine/worker-tools.ts`) restricts `type` to plan/code. No engine path runs final reviews through the CLI. Guard is safe. |
| 2 | GitNexus index does not track `runSpineReviewStep` (bin/ CLI export); manual rg blast-radius used instead: 3 callers (worker-tools.ts, bin/spine.mjs:123, CLI entrypoint). Risk LOW. |
| 3 | `tests/batch/review.test.mjs:540` ("stub worker stops when enforced review spawn fails") already deletes the same live-journal keys inline — refactored to `withoutLiveJournalEnv` for one source of truth. |
| 4 | **Scope amendment:** `tests/worker-tools/review-step-tool.test.mjs` is in the contract `testCommand` but not File Scope. The Step 3 attach-env gate cannot pass without isolating it: its three worker-tool tests (plan APPROVE, plan stub-fail, code nested-skip) journal via env **by design** (legit worker path), so inherited `SPINE_JOURNAL_ATTACH=1 SPINE_PROJECT_ROOT=<faketest>` wrote a journal into the fake root. Added save/clear/restore of `LIVE_JOURNAL_ENV_KEYS` around all three — logically required to complete the scoped change (taskplane-worker: "paths logically required"). |
| 5 | **Pre-existing coverage flakes:** `npm run coverage:check` aborts on `waitForSequenceBatchTerminal hard-caps at maxWaitMs even while engine progresses` and/or `...does not extend the wait for a reused PID` (SP-802 tests in `tests/batch/sequence-detached-poll.test.mjs`, 150–300ms real-time budgets). Proven pre-existing: identical failures on base commit `e187d755` under machine load 29–57 (concurrent batch lanes); they pass in isolation (24/24). Failing count varies 1↔2 with load. Aggregate line coverage is unaffected: 90.08% ≥ 77%. Needs a follow-up task to make budgets load-tolerant (out of SP-812 File Scope). |

## Plan (Review Level 1)

1. `bin/spine-review-step.mjs`: env-derived journal (`resolveBatchJournalContext()`) only for `--type plan`/`code`; `--type final` without explicit `options.journal` does not journal.
2. New `tests/helpers/live-journal-env.mjs`: `LIVE_JOURNAL_ENV_KEYS` + `withoutLiveJournalEnv(env)`.
3. Isolate three tests: `review.test.mjs` final-CLI test (save/clear/restore keys), `stub-runner-delivery.test.mjs` spawn env, `worker-runner-done-missing.test.mjs` two spawn envs.
4. Regression test in `review.test.mjs`: attach env + no `journal` → `--type final` writes no journal file; `--type plan` still journals.

## Blockers

_None._
