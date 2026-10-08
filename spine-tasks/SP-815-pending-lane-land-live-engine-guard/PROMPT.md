# Task: SP-815 — No salvage recommendation while the engine is alive and a task is mid-review

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** One diagnosis predicate. A too-broad guard would hide a real stranded lane after an engine crash.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** `shouldDiagnosePendingLaneLand` (`src/batch/diagnosis-pending-lane.mjs` 21-30) fires on `doneInLane && !doneOnMain`, `orchMergedToBase`, and `allTasksTerminalSuccess`. It runs second in `deriveDiagnosis` precedence (`src/batch/reconcile-diagnosis.mjs` ~207). In batch `20260928T231505-8eee` a task's lane `.DONE` was reconciled (`done_in_lane_terminal`) during code rework. The signals said `allTasksTerminalSuccess: true, hasRunningTasks: false` while `batch-state.json` still had `phase: running`, task `SP-276` `status: running`, and the engine (PID 49095) was alive in the final review. Diagnosis recommended `spine batch salvage --lane 1 --integrate` under a live engine. Engine liveness is not on `signals` (`reconcile-batch.mjs` computes it after diagnosis and is at the line cap). `signals.raw` is the batch state (`reconcile-batch.mjs` 178/253). Liveness helpers: `readBatchEnginePid(raw)`, `readBatchEngineStartedAt(raw)` (`src/batch/state-guards.mjs` 117/139), `isEngineProcessAlive(pid, startedAt, options)` (`src/process/liveness.mjs` 184).

## Mission

Closes #330 — `pending_lane_land` (and its salvage command) is never derived while the batch engine is alive and the batch state still has a running phase or a running task.

1. **Guard** (`src/batch/diagnosis-pending-lane.mjs`): `shouldDiagnosePendingLaneLand(signals, deps = {})` returns `false` before the existing checks when **both** hold:
   - the engine is alive: `deps.isEngineAlive ?? ((raw) => isEngineProcessAlive(readBatchEnginePid(raw), readBatchEngineStartedAt(raw)))` applied to `signals.raw`, with `null` pid → not alive.
   - the raw state is active: `signals.raw.phase === "running"` **or** any `signals.raw.tasks[].status === "running"`.
   Extract as an exported helper `isLiveEngineMidTask(raw, deps)`. Keep every existing branch unchanged when the guard does not fire. Diagnosis then falls through to the normal running/reviewing path.
2. **Tests** — new `tests/batch/diagnosis-pending-lane-live-engine.test.mjs`:
   - #330 shape (signals from the issue: `allTasksTerminalSuccess: true`, `orchMergedToBase: true`, task `doneInLane && !doneOnMain`; raw `phase: running`, one task `running`) with `isEngineAlive: () => true` → `false`.
   - same with `isEngineAlive: () => false` → `true` (crashed engine still gets salvage guidance).
   - engine alive but raw phase not running and no running task → `true`.
   - `stateDrift.drifted` case with live engine and running task → `false`.
   - `deriveDiagnosis` end-to-end on the #330 signals with a live current-process PID in `raw.resilience.enginePid` → diagnosis is not `pending_lane_land`.

## Dependencies

- **None**

## Context to Read First

- GitHub #330
- `src/batch/diagnosis-pending-lane.mjs` (64 lines); `src/batch/reconcile-diagnosis.mjs` 184-230
- `src/batch/state-guards.mjs` 113-150; `src/process/liveness.mjs` 170-210
- `tests/batch/diagnosis-salvage-pending-lane.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/diagnosis-pending-lane.mjs`
- `tests/batch/diagnosis-pending-lane-live-engine.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis-pending-lane-live-engine.test.mjs tests/batch/diagnosis-salvage-pending-lane.test.mjs tests/batch/diagnosis.test.mjs tests/batch/batch-complete-engine.test.mjs tests/batch/post-done-plan-review-spawn.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis-pending-lane.mjs`, `tests/batch/diagnosis-pending-lane-live-engine.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `shouldDiagnosePendingLaneLand` — record callers in Discoveries
- [ ] Confirm importing `state-guards.mjs` / `liveness.mjs` adds no import cycle
- [ ] Dependencies satisfied

### Step 1: Guard

- [ ] `isLiveEngineMidTask` + early return

**Artifacts:**
- `src/batch/diagnosis-pending-lane.mjs` (modified)

### Step 2: Tests

- [ ] Five cases above

**Artifacts:**
- `tests/batch/diagnosis-pending-lane-live-engine.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] No salvage recommendation under a live engine with a running task
- [ ] Crashed-engine salvage guidance unchanged
- [ ] Closes #330

## Git Commit Convention

- `fix(SP-815): suppress pending_lane_land while engine is alive mid-task (#330)`

## Do NOT

- Edit `src/batch/reconcile-batch.mjs` (at the line cap) or change diagnosis precedence order
- Change the reconcile `done_in_lane_terminal` rule
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
