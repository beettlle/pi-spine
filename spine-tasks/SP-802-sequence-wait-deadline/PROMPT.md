# Task: SP-802 — Sequence wait: hard cap, stall detection and PID-reuse-safe liveness

**Created:** 2026-09-27
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Sequence orchestration wait loop; too-tight defaults would abort healthy long waves.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `waitForSequenceBatchTerminal` (`src/batch/sequence-wait.mjs` ~48-88) loops `while (Date.now() < deadline || isEngineStillRunning(...))`, so a live-but-deadlocked engine makes `spine run sequence` wait forever. `isEngineStillRunning` (~94-100) reads `raw?.enginePid` at the top level, but `recordBatchEnginePid` writes only `resilience.enginePid` (`src/batch/state-guards.mjs` ~126-132), so the state fallback never fires; and it uses `isProcessAlive` without the recorded start time, so a reused PID extends the wait (#259). The docstring's "or the batch phase is active" is not implemented.

## Mission

Closes #307 — The sequence wait always ends: a hard cap, a no-progress stall exit, and PID-reuse-safe liveness, while keeping "extend while alive and progressing".

1. **Config** (`src/config/spine-config-schema.mjs`, `src/config/defaults.mjs` `ORCHESTRATOR_DEFAULTS`): `orchestrator.sequenceMaxWaitMs` (default 24 h) and `orchestrator.sequenceStallMs` (default 30 min), validated as positive integers like the existing poll keys, with `resolveSequenceMaxWaitMs` / `resolveSequenceStallMs` helpers.
2. **Hard cap**: the loop never runs past `startedAt + maxWaitMs`; on expiry return `{ ok: false, error: "sequence_wait_timeout", diagnosis, reconciliation, batchId, suggestedCommand: "spine status --diagnose" }`.
3. **Stall exit**: while extending past `timeoutMs` because the engine is alive, track the newest progress signal — batch-state `updatedAt`, the latest journal event timestamp, and lane heartbeat timestamps (use whatever `reconcileBatch` / existing readers expose; do not add new state fields). If none advanced for `stallMs`, return `{ ok: false, error: "engine_stalled", …, suggestedCommand: "spine status --diagnose" }`.
4. **Liveness**: `isEngineStillRunning` uses `readBatchEnginePid` + `readBatchEngineStartedAt` + `isEngineProcessAlive` (from `src/process/liveness.mjs`). The explicit `enginePid` argument is paired with the state's recorded start time when the PIDs match; otherwise it falls back to `isProcessAlive`. Remove the dead top-level `raw?.enginePid` read.
5. **Caller**: `src/batch/sequence-run.mjs` ~337 passes the resolved config values and surfaces `sequence_wait_timeout` / `engine_stalled` with their `suggestedCommand` in the halt output.
6. **Tests** (`tests/batch/sequence-detached-poll.test.mjs`): stalled engine (live PID, frozen `updatedAt` and journal) → `engine_stalled`; max-wait → `sequence_wait_timeout`; PID reuse (start-time mismatch) does not extend the wait; the existing "extend while alive and progressing" test still passes. Use small injected `maxWaitMs` / `stallMs` / `pollIntervalMs` so tests run in < 2 s.

## Dependencies

- **Task:** SP-798 (both edit `src/config/defaults.mjs`; land the lanes allow-list first)

## Context to Read First

- GitHub #307 (related #259)
- `src/batch/sequence-wait.mjs` ~48-100
- `src/batch/state-guards.mjs` — `readBatchEnginePid`, `readBatchEngineStartedAt`
- `src/process/liveness.mjs` — `isEngineProcessAlive`
- `src/config/spine-config-schema.mjs` — `validateOrchestratorConfig`, `resolveSequencePollMs`
- `src/batch/sequence-run.mjs` ~320-360
- `tests/batch/sequence-detached-poll.test.mjs` ~121-173

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/sequence-wait.mjs`
- `src/batch/sequence-run.mjs`
- `src/config/spine-config-schema.mjs`
- `src/config/defaults.mjs`
- `tests/batch/sequence-detached-poll.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/sequence-detached-poll.test.mjs tests/batch/reconcile-light.test.mjs tests/config/*.test.mjs` |
| fileScopeMustChange | `src/batch/sequence-wait.mjs`, `tests/batch/sequence-detached-poll.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm what progress timestamps `reconcileBatch` / state / journal readers already expose
- [ ] `rg -n "waitForSequenceBatchTerminal|timeout_waiting_for_batch" src tests` — list callers and assertions
- [ ] Dependencies satisfied

### Step 1: Config keys

- [ ] `orchestrator.sequenceMaxWaitMs`, `orchestrator.sequenceStallMs` defaults + validation + resolvers

**Artifacts:**
- `src/config/spine-config-schema.mjs`, `src/config/defaults.mjs` (modified)

### Step 2: Wait loop + liveness + caller

- [ ] Hard cap → `sequence_wait_timeout`
- [ ] No-progress → `engine_stalled`
- [ ] PID + start-time liveness; dead read removed
- [ ] `sequence-run.mjs` passes config and surfaces results

**Artifacts:**
- `src/batch/sequence-wait.mjs`, `src/batch/sequence-run.mjs` (modified)

### Step 3: Tests

- [ ] Stalled engine
- [ ] Max wait
- [ ] PID reuse
- [ ] Existing extend-while-progressing still green

**Artifacts:**
- `tests/batch/sequence-detached-poll.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run full suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803 documents the new config keys and results)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — `sequencePollMs` mentions

## Completion Criteria

- [ ] Live PID with no progress for `stallMs` → `engine_stalled`
- [ ] Wait never exceeds `maxWaitMs`
- [ ] Reused PID does not extend the wait
- [ ] Extend-while-progressing preserved
- [ ] Closes #307

## Git Commit Convention

- `fix(SP-802): bound sequence wait with max-wait, stall exit and PID start-time liveness (#307)`

## Do NOT

- Restart the engine automatically
- Change stall-watchdog behavior inside the engine (#308)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
