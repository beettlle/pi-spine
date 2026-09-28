# SP-801: Worker fails closed when pi is missing — Status

**Current Step:** Step 4
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Tests unsetting stub env listed
- [x] Launch-failure shape noted
- [x] Dependencies satisfied

### Step 1: Fail closed
**Status:** ✅ Complete

- [x] Implicit stub removed
- [x] `pi_missing` fail-closed

### Step 2: Tests
**Status:** ✅ Complete

- [x] pi missing case
- [x] Explicit stub case
- [x] `agentSession` case

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Batch suite
- [x] Coverage gate
- [x] Fix all failures

**Evidence (2026-09-28):** `npm run lint` + `npm run typecheck` clean; contract testCommand 37/37 pass; `npm run test:batch` (stub=1) 1554/1554 pass; `npm run coverage:check` 2712/2712 pass, 89.89% line coverage (threshold 77%), exit 0.

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact on `runWorker`: **CRITICAL** upstream risk — 5 direct callers (`runNonMatrixTaskOnLane`, `runMatrixTaskOnLane`, `runMatrixSubLane`, `runResumedTaskOnLane`, `runReviewPollLoop`), 6 processes. Intended blast radius: this is the shared worker launch path the task hardens. Change kept minimal. |
| 2 | CI (`.github/workflows/ci.yml`) runs unit tests on ubuntu-latest **without pi on PATH** — the mock `pi` is added only for the later CLI smoke step. So `tests/batch/worker-spawn-errors.test.mjs` ("non-executable launch script yields launch_failed") silently relied on the implicit stub fallback for its first `runWorker` call in CI. Fix (out of File Scope but logically required, PROMPT Step 0 anticipates it): set `SPINE_WORKER_STUB = "1"` before the first call — the launch-script EACCES spawn path is stub-agnostic. |
| 3 | Placement decision: guard goes **after** `assertReviewToolAvailable` and after `isExecute`/`runCommand` are computed (immediately before the spawn decision), not literally right after the `useStub` line. Reasons: (a) `review.test.mjs` "runWorker fails closed when review tool unavailable" runs stub-unset at review level 2 — the reviewer path already fails closed; keeping review-gate precedence preserves it (its `SPINE_REVIEW_TEST_NO_PI` hook only affects the review-side `commandExists`, not `src/util/command-exists.mjs`); (b) execute-only tasks never spawn `pi` (`spawnExecutionOnlyHandle` runs the contract command) — failing those closed would break `execution-only.test.mjs` and the hostile-folder test in CI. Both orderings fail closed; mission intact. |
| 4 | Tests that delete/unset `SPINE_WORKER_STUB` but need **no** fix: `tests/doctor/stall-config.test.mjs`, `tests/doctor/batch-size-guidance.test.mjs` (`isStubWorkerMode` is env-keyed only), `tests/worker-tools/review-step-tool.test.mjs` (review CLI args), `tests/batch/worker-backend.test.mjs` agentSession test (guard excludes agentSession backend), `tests/batch/review.test.mjs` (review-failed precedence preserved). |
| 5 | Launch-failure return shape: pre-spawn failures in `runWorker` return `{ ok: false, exitCode: 1, mode, output, classification, doneFound: false }` directly (see the `review.failed` return); post-spawn launch failures go through `buildWorkerFailureResult` (adds `workerOutputLogPath`/`workerOutputLogRef`). The new pre-spawn guard matches the direct shape, mirroring `review-step-run.mjs` fail-closed message style. |
| 6 | `docs/adoption/operator-runbook.md` §3 "Worker backend default" reviewed — it documents only explicit `SPINE_WORKER_STUB=1` forcing the stub; no implicit-fallback text exists → no doc change needed. |
| 7 | `scripts/run-coverage.mjs` (CI `coverage:check` entry) and the Contract testCommand both run with `SPINE_WORKER_STUB=1` ambient — the new fail-closed test explicitly deletes the var, so it passes under ambient-stub, no-stub, and pi-present invocations. |
| 8 | Discovery #2 fix applied: `tests/batch/worker-spawn-errors.test.mjs` EACCES test now sets `SPINE_WORKER_STUB="1"` before its first `runWorker` call; duplicate set before the second call removed. No other test relied on the implicit fallback (all direct `runWorker` callers set the stub, run review-level>0 gate first, use execute-type prompts, or use the agentSession backend). |

## Blockers

_None._
