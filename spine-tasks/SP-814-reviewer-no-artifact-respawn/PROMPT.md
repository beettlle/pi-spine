# Task: SP-814 — Reviewer no-artifact: capture output, keep a log, re-spawn once

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every engine review (plan, code, final) passes through `spawnReviewerPi` and `runStepReview`. A wrong retry rule doubles reviewer cost or masks real failures.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** v2.26.0 waves 2 and 4 failed tasks with `final_review_spawn_failed` / `plan_review_spawn_failed` and `reviewer exited but produced no artifact` after a ~10 s reviewer life; a manual `spine batch retry` then passed. `spawnReviewerPi` (`src/batch/review-spawn.mjs` 186-328) pipes stdout but never reads it, keeps stderr only for non-zero exits, and on exit 0 returns `{ spawnFailed: false, exitCode: 0, error: "" }`. `runStepReview` (`src/batch/review-step-run.mjs` 216-305) then hits the `!fs.existsSync(artifactPath)` branch (~285), journals `review.failed { spawnFailed: true }` with no exit code or output, and returns. `runReviewPollLoop` (`src/batch/engine-lanes/review-poll.mjs` 282-305) turns that into `<type>_review_spawn_failed` with no retry. Nothing writes reviewer output anywhere. `src/batch/worker-output.mjs` (496/500 by policy count) has the worker log conventions (`workerOutputLogPath`, `persistWorkerOutputLog`, `redactWorkerOutput`, `captureWorkerOutputTail`).

## Mission

Closes #332 — A reviewer exit without an artifact is retried once automatically, and every remaining failure carries diagnostics and a log file. Partial #294 (item 3: bounded auto-retry of a review spawn failure).

1. **Capture** (`src/batch/review-spawn.mjs` `spawnReviewerPi`): drain stdout (bounded — reuse the worker tail cap/redaction helpers), keep stderr for every exit, and return `stdoutTail`, `stderrTail`, `durationMs` on every result including exit 0.
2. **Reviewer log** — new `src/batch/reviewer-output.mjs`: `reviewerOutputLogPath(projectRoot, batchId, laneNumber, taskId, reviewType)` → `.spine/runtime/<batchId>/lanes/lane-<n>/reviewer-output-<taskId>-<reviewType>.log`, `reviewerOutputLogRef(...)` (root-relative), and `persistReviewerOutputLog(...)` (redacted, tail-capped, atomic write — reuse exports from `worker-output.mjs`; do **not** edit `worker-output.mjs`). Write the log on every failed attempt when `journal` has `projectRoot` + `batchId`.
3. **One re-spawn** (`src/batch/review-step-run.mjs`): when the reviewer exited 0 with no artifact, or failed with `spawnFailed` for a reason other than timeout (exit 124 / `REVIEW_TIMEOUT_REASON`) and `nested_spawn_blocked`, journal `review.spawn_retry` `{ stepNumber, reviewType, attempt: 2, reason, exitCode, durationMs, reviewerOutputLogRef }` and spawn once more with the same prompt and artifact path. Constant `REVIEW_SPAWN_MAX_ATTEMPTS = 2`.
4. **Diagnostics on final failure:** the `review.failed` payload and the returned result add `exitCode`, `durationMs`, `outputTail` (stderr + stdout tail, redacted, ≤ 2 KB) and `reviewerOutputLogRef`. Keep `error` text and `spawnFailed: true` unchanged so `<type>_review_spawn_failed` classification and existing consumers still work.
5. **Tests:**
   - new `tests/batch/review-no-artifact-respawn.test.mjs` with a fake `pi` on `PATH` (pattern: `tests/batch/review-spawn.test.mjs`, `tests/batch/worker-runner-done-missing.test.mjs` fake `pi`) that counts invocations in a temp file:
     - attempt 1 exits 0 without an artifact, attempt 2 writes a valid artifact → review succeeds; `review.spawn_retry` journaled; no `review.failed`; reviewer log exists for attempt 1.
     - both attempts produce no artifact → exactly 2 spawns; `review.failed` has `exitCode: 0`, `durationMs`, `outputTail` containing the fake reviewer's stderr line, `reviewerOutputLogRef` pointing at an existing file.
     - timeout path (exit 124) → no re-spawn (existing timeout honor behaviour unchanged).
     - non-zero exit with stderr → re-spawned once; stderr in `outputTail`.
   - `tests/batch/review-spawn.test.mjs`: result carries `stdoutTail` / `stderrTail` / `durationMs` on exit 0.

## Dependencies

- **None**

## Context to Read First

- GitHub #332; GitHub #294 (Expected item 3)
- `src/batch/review-spawn.mjs` 60-328; `src/batch/review-step-run.mjs` 100-305
- `src/batch/engine-lanes/review-poll.mjs` 282-305 (read-only — classification stays)
- `src/batch/worker-output.mjs` 20-134, 254-274 (read-only — reuse exports)
- `tests/batch/review-spawn.test.mjs`, `tests/batch/review.test.mjs` 236-380, `tests/batch/engine-final-review-timeout.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-spawn.mjs`
- `src/batch/review-step-run.mjs`
- `src/batch/reviewer-output.mjs`
- `tests/batch/review-no-artifact-respawn.test.mjs`
- `tests/batch/review-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review-no-artifact-respawn.test.mjs tests/batch/review-spawn.test.mjs tests/batch/review.test.mjs tests/batch/engine-final-review-timeout.test.mjs tests/batch/review-spawn-timeout-recovery.test.mjs tests/batch/post-done-plan-review-spawn.test.mjs tests/batch/nested-reviewer-guard.test.mjs tests/compat/incidents.test.mjs` |
| fileScopeMustChange | `src/batch/review-spawn.mjs`, `src/batch/review-step-run.mjs`, `src/batch/reviewer-output.mjs`, `tests/batch/review-no-artifact-respawn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `spawnReviewerPi`, `runStepReview` — record in Discoveries
- [ ] Confirm timeout and `nested_spawn_blocked` branches and their tests
- [ ] Dependencies satisfied

### Step 1: Capture + reviewer log

- [ ] stdout drained; tails + duration on every result
- [ ] `reviewer-output.mjs` log helpers

**Artifacts:**
- `src/batch/review-spawn.mjs` (modified), `src/batch/reviewer-output.mjs` (new)

### Step 2: Re-spawn + diagnostics

- [ ] One re-spawn for no-artifact / non-timeout spawn failure; `review.spawn_retry`
- [ ] `review.failed` diagnostics; classification unchanged

**Artifacts:**
- `src/batch/review-step-run.mjs` (modified)

### Step 3: Tests

- [ ] Recover on attempt 2
- [ ] Both attempts fail → diagnostics + log
- [ ] Timeout not retried; non-zero exit retried once

**Artifacts:**
- `tests/batch/review-no-artifact-respawn.test.mjs` (new), `tests/batch/review-spawn.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Transient no-artifact reviewer exits recover without operator retry
- [ ] Persistent failures journal exit code, duration, output tail and a log path
- [ ] Timeout and nested-spawn behaviour unchanged
- [ ] Closes #332

## Git Commit Convention

- `fix(SP-814): re-spawn reviewer once on no-artifact exit; keep reviewer logs (#332)`

## Do NOT

- Edit `src/batch/worker-output.mjs` (at the line cap) or `src/batch/engine-lanes/review-poll.mjs`
- Edit review honor finders (SP-813)
- Change plan-review ordering (#294 items 1–2)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
