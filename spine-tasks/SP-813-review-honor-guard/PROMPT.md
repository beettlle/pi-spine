# Task: SP-813 — Engine never honors foreign stub verdicts; contract verify before final honor

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every review phase's honor fast path changes; too strict a filter re-runs reviews that should be honored (cost, possible `review_exhausted`), too loose keeps the #328 hole.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1
**Problem theory:** `honorCompletedReview` (`src/batch/engine-lanes/review-poll.mjs` 117-175) honors any journaled pass verdict found by `findCompletedFinalReview` (`src/batch/review-artifacts.mjs` 375-419) / `findCompletedCodeReview` (82-127) / private `findCompletedPlanReview` (`src/batch/engine-lanes/review-plan.mjs` 63-110). None checks `payload.stub`, artifact location or batch stub mode. In `runFinalReviewPhase` (`src/batch/engine-lanes/review-final.mjs` 235-354) the honor fast path (262-278) returns before `runReviewPollLoop` calls `beforeReview` (291-340), which is the only place `verifyContract` runs and `contract.verified` is journaled. Legitimate cases that must still honor: `honorReviewSpawnFailureWhenEligible` journals `{ stub: true, honored: true, honorReason: "spawn_timeout_with_done" }` in real batches (`src/batch/review-step.mjs` 357-366); `tests/batch/final-review-honor.test.mjs` 251-321 uses a **relative** `artifactPath`; engine plan stub journals `stub: true` in stub batches (`review-plan.mjs` 168-180). Stub mode is env-only: `isStubWorkerMode()` (`src/batch/contract-parse.mjs` 78-80), `shouldUseReviewStub(env)` (`src/batch/engine-lanes/review-stub.mjs` 24-30).

## Mission

Closes #328 — The engine only honors journaled review verdicts it can trust, and contract verification always runs before a task completes through a final-review honor.

1. **Trust predicate** in `src/batch/review-artifacts.mjs`: `isHonorableReviewEvent(event, { taskFolder, worktreePath, stubMode })` → `{ ok: true } | { ok: false, reason }`:
   - `payload.stub === true` and `payload.honored !== true` and `!stubMode` → `{ ok: false, reason: "stub_verdict_in_live_batch" }`.
   - `payload.artifactPath` absolute and not inside `taskFolder` (resolve real paths; relative paths are resolved against `worktreePath` / `taskFolder` and accepted when inside) → `{ ok: false, reason: "artifact_outside_task_folder" }`.
   - otherwise ok. `stubMode` = `shouldUseReviewStub(process.env)` (covers `SPINE_WORKER_STUB` and `SPINE_REVIEW_STUB`) — compute at the caller and pass in.
2. **Apply it** in `findCompletedFinalReview`, `findCompletedCodeReview` and `findCompletedPlanReview`: skip untrusted events (fall through to the next candidate / artifact scan exactly as if the event were absent). Expose rejected events to the caller so the phase can journal `review.honor_rejected` `{ taskId, reviewType, reason, artifactPath }` once per rejected event (do not journal on every poll — dedupe by event timestamp/id).
3. **Contract before final honor** (`src/batch/engine-lanes/review-final.mjs`): run the same contract verification that `beforeReview` runs (and journal `contract.verified` / record failure via `recordContractVerifyTaskFailure`) **before** the honor fast path returns, guarded so it runs once per phase entry (do not double-verify when the poll loop then runs). Respect `shouldRunContractVerifyForWorker` (stub batches keep skipping).
4. **Tests:**
   - new `tests/batch/review-honor-guard.test.mjs`: reproduce #328 — live (non-stub) batch journal with a foreign `review.completed` final `PASS` `{ stub: true }` and an absolute `/tmp/.../TP-777-review/...` artifact under the real task ID → not honored, `review.honor_rejected` journaled once, `contract.verified` journaled before completion; `{ stub: true, honored: true, honorReason: "spawn_timeout_with_done" }` still honored; stub batch (`SPINE_WORKER_STUB=1`) still honors stub verdicts; absolute artifact inside the task folder honored; plan and code finders apply the same rules.
   - `tests/batch/final-review-honor.test.mjs`: existing relative-path honor still passes; add an assertion that `contract.verified` precedes `task.verdict_recorded { honored: true }` for a real (non-stub) final honor.

## Dependencies

- **None**

## Context to Read First

- GitHub #328 (journal excerpt, suggested fixes)
- `src/batch/engine-lanes/review-poll.mjs` 48-175 (`appendReviewHonorJournalEvents`, `honorCompletedReview`), 216-305
- `src/batch/engine-lanes/review-final.mjs` 120-354; `src/batch/engine-lanes/review-plan.mjs` 63-110, 150-260; `src/batch/engine-lanes/review-code.mjs` (read-only unless the code finder call needs the reject list)
- `src/batch/review-artifacts.mjs` 82-127, 195-221, 375-419
- `src/batch/review-step.mjs` 340-370; `src/batch/contract-parse.mjs` 63-80; `src/batch/engine-lanes/review-stub.mjs` 24-30

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests create temp git repos)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-artifacts.mjs`
- `src/batch/engine-lanes/review-final.mjs`
- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/engine-lanes/review-code.mjs`
- `tests/batch/review-honor-guard.test.mjs`
- `tests/batch/final-review-honor.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/review-honor-guard.test.mjs tests/batch/final-review-honor.test.mjs tests/batch/review-crash-recovery.test.mjs tests/batch/engine-code-review.test.mjs tests/batch/engine-review-orphan.test.mjs tests/batch/review-spawn-timeout-recovery.test.mjs tests/batch/reviewer-artifact-early-honor.test.mjs tests/batch/contract-verify.test.mjs` |
| fileScopeMustChange | `src/batch/review-artifacts.mjs`, `src/batch/engine-lanes/review-final.mjs`, `tests/batch/review-honor-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `honorCompletedReview`, `findCompletedFinalReview`, `findCompletedCodeReview`, `runFinalReviewPhase` — record in Discoveries
- [ ] List every legitimate `stub: true` producer and relative-`artifactPath` test (keep them honoring)
- [ ] Dependencies satisfied

### Step 1: Trust predicate + finders

- [ ] `isHonorableReviewEvent`
- [ ] Final / code / plan finders skip untrusted events; `review.honor_rejected` journaled once

**Artifacts:**
- `src/batch/review-artifacts.mjs`, `src/batch/engine-lanes/review-plan.mjs`, `src/batch/engine-lanes/review-code.mjs` (modified)

### Step 2: Contract before final honor

- [ ] Contract verification runs before the honor fast path, once per phase entry

**Artifacts:**
- `src/batch/engine-lanes/review-final.mjs` (modified)

### Step 3: Tests

- [ ] #328 reproduction rejected; contract verified
- [ ] Legit stub/honored and relative-path cases still honor
- [ ] Plan/code finders covered

**Artifacts:**
- `tests/batch/review-honor-guard.test.mjs` (new), `tests/batch/final-review-honor.test.mjs` (modified)

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

- [ ] Foreign stub verdicts and out-of-folder artifacts are never honored in a live batch
- [ ] `contract.verified` always precedes a non-stub final-review honor
- [ ] Legit honors (spawn-timeout-with-done, relative paths, stub batches) unchanged
- [ ] Closes #328

## Git Commit Convention

- `fix(SP-813): refuse untrusted review honors; verify contract before final honor (#328)`

## Do NOT

- Edit `src/batch/review-step-run.mjs` or `src/batch/review-spawn.mjs` (SP-814)
- Edit `src/batch/engine-lanes.mjs` (at the line cap)
- Change verdict values or review attempt caps
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
