# Task: SP-861 — pause/retry recovery: no stale_engine_pid refuse; detached resume not blocked by false attached engine

**Created:** 2026-11-16
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Operators cannot recover `needs_retry` batches without killing PIDs or fighting attached/detached ownership — release dogfood dead-end.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** On v2.30.0, pause → retry → detached resume dead-ends: retry may print OK but journals **refused batch-state write (`stale_engine_pid`)** (`evaluateBatchStateWriteGuard` in `src/batch/state-guards.mjs`), then `spine batch resume` fails with **Attached batch engine already running** (`src/batch/attached-runner-reconcile.mjs`) even when the operator is trying a detached recovery. Related closed class: #197 / #196 / #370.

## Mission

Closes #376 — Pause/retry/resume recovery works without killing the engine by hand:

1. **Retry after pause** — After a successful `spine batch pause` (phase paused / engine ownership handed off), `spine batch retry <taskId>` must persist the retry reset without `stale_engine_pid` refusal when the operator CLI is the legitimate writer (no live foreign engine that still owns the batch). If a live engine truly still owns the batch, refuse clearly with a wait/kill suggestion — do not silently no-op.
2. **Detached resume** — When diagnose/recovery expects detached `resume` / `resume --force`, do not block with "Attached batch engine already running" solely because a stale attached-child bookkeeping bit remains after pause. If a real live engine PID is still running the batch, keep the existing refuse + suggest `resume --attached --force` only for that true case.
3. **Tests** — Cover: pause then retry succeeds (state write allowed / retry fields persisted); detached resume after pause+retry is not blocked by a false attached flag; true live attached engine still refuses detached resume.

## Dependencies

- **None** (serialize with SP-862 via plan if analyze shows shared hot files)

## Context to Read First

- GitHub #376
- `src/batch/state-guards.mjs` (`evaluateBatchStateWriteGuard`, `stale_engine_pid`)
- `src/batch/attached-runner-reconcile.mjs` (attached engine already running)
- `src/batch/resume-engine.mjs` (`terminateStaleDetachedEngine`, orphan handoff)
- `tests/batch/batch-state-stale-writer.test.mjs`, `tests/batch/engine-liveness-starttime.test.mjs`, `tests/batch/detached-resume-wait.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/state-guards.mjs`
- `src/batch/attached-runner-reconcile.mjs`
- `src/batch/resume-engine.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/batch-state-stale-writer.test.mjs`
- `tests/batch/detached-resume-wait.test.mjs`
- `tests/batch/engine-liveness-starttime.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/batch-state-stale-writer.test.mjs tests/batch/detached-resume-wait.test.mjs tests/batch/engine-liveness-starttime.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-861` |
| fileScopeMustChange | `src/batch/state-guards.mjs`, `tests/batch/batch-state-stale-writer.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `evaluateBatchStateWriteGuard`, attached-resume refuse path; report blast radius (HIGH/CRITICAL → acknowledge + mitigate)
- [ ] `rg -n "stale_engine_pid|Attached batch engine already running" src/ tests/`

### Step 1: Guard + resume ownership

- [ ] Pause+retry persists without false `stale_engine_pid`
- [ ] Detached resume not blocked by false attached ownership; true live engine still refuses

**Artifacts:**
- `src/batch/state-guards.mjs`, `src/batch/attached-runner-reconcile.mjs`, and/or `src/batch/resume-engine.mjs` (modified as needed)

### Step 2: Tests

- [ ] Pause+retry write; false vs true attached resume cases

**Artifacts:**
- relevant `tests/batch/*.test.mjs` (modified/added)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (runbook owned by SP-857)
- [ ] Create `spine-tasks/SP-861-pause-retry-stale-engine-pid/.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-857 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — leave to SP-857

## Completion Criteria

- [ ] Pause → retry persists without `stale_engine_pid` when no live foreign owner
- [ ] Detached resume after pause+retry works without false attached refuse
- [ ] True live attached engine still blocks detached resume
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-861): pause/retry recovery without stale_engine_pid dead-end`

## Do NOT

- Remove owner checks entirely (that reopens concurrent writers)
- Require `dismiss --force` as the happy path
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
