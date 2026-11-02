# Task: SP-851 — Detached resume ignores the batch's pre-resume failed state

**Created:** 2026-11-01
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** A false "resume failed" on a running engine pushes operators into a second resume or an abort of a healthy batch.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `waitForDetachedBatchResume` (`src/batch/detached-wait.mjs` ~290-346) checks `raw.phase === "failed" || raw.phase === "aborted"` before it checks `updatedAt > updatedAtBefore` (~320). Resuming an already-`failed` batch (`spine batch retry <task>` then `spine batch resume --force`) reads the old state on the first poll and returns `batch_engine_failed`. `src/batch/detached-run.mjs` (~300) prints `Batch resume failed (phase=failed)`, and `attachDetachedFailureDiagnostics` (`src/batch/detached-diagnostics.mjs` ~122) adds the stale `Last task.failed` event. Seen in batch `20261023T030941-33c5` (v2.28.1): engine PID alive, SP-845 restarted and succeeded.

## Mission

Closes #370 — A detached resume of a failed batch reports the engine as started once it writes `running`:

1. In `waitForDetachedBatchResume`, treat `failed` / `aborted` as `batch_engine_failed` only when `updatedAt > updatedAtBefore`. A pre-resume terminal state keeps polling until the new engine writes `running` (→ `engine_started`) or the wait times out.
2. Tests: start from `failed` with an unchanged `updatedAt`, then write `running` with a newer `updatedAt` → `engine_started`. A `failed` state written after the resume started (newer `updatedAt`) → `batch_engine_failed`. Same for `aborted`.

## Dependencies

- **None**

## Context to Read First

- GitHub #370
- `src/batch/detached-wait.mjs` 100-130, 280-346
- `tests/batch/detached-resume-wait.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio + OpenJev for the stet `reviewCommand` only
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/detached-wait.mjs`
- `tests/batch/detached-resume-wait.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/detached-resume-wait.test.mjs tests/batch/detached-resume-gate.test.mjs tests/batch/detached-resume-orphan-pid.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh lenient SP-851` |
| fileScopeMustChange | `src/batch/detached-wait.mjs`, `tests/batch/detached-resume-wait.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `waitForDetachedBatchResume`; report the blast radius in STATUS

### Step 1: Fix the ordering

- [ ] `failed` / `aborted` are engine failures only with `updatedAt > updatedAtBefore`

**Artifacts:**
- `src/batch/detached-wait.mjs` (modified)

### Step 2: Tests

- [ ] Stale `failed` then fresh `running` → `engine_started`
- [ ] Fresh `failed` / `aborted` → `batch_engine_failed`

**Artifacts:**
- `tests/batch/detached-resume-wait.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-851-detached-resume-stale-failed/.DONE`

**Stet review (Contract `reviewCommand`, blocking):** fix real defects in this task's diff. For a stet false positive, `stet dismiss <id> <reason>` citing lint/typecheck/test evidence, record it under Discoveries, and file it at https://github.com/beettlle/stet/issues. Never edit `.review/` or remove the `reviewCommand`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` detached resume section (note in Discoveries; do not edit)

## Completion Criteria

- [ ] Resuming a failed batch detached no longer reports a false failure

## Git Commit Convention

- `fix(SP-851): detached resume ignores pre-resume failed state`

## Do NOT

- Change the wait timeout or poll interval defaults
- Edit `src/batch/detached-run.mjs` or `src/batch/detached-diagnostics.mjs` unless a test proves it necessary (record via Amendments)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
