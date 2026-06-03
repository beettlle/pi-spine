# Task: TP-013 — Checkpoint heartbeat (Phase 2)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Extends the batch engine with liveness signals used by reconciliation and stall policy. Incorrect heartbeat or stall logic can kill healthy workers or miss zombies.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Implement **FR-WORK-09** and the engine-side hooks for **§18.4 progress-aware stall** on the pi-spine single-lane path. Workers (or the worker host) emit `lane.heartbeat` / checkpoint events to the journal; the engine updates lane heartbeat timestamps in batch state; reconciliation can classify `LaneStale` and emit `lane.stall_warning` before kill.

**In scope:** journal events (`lane.heartbeat`, `task.step_completed` or equivalent), batch-state lane `lastHeartbeatAt`, worker-host polling that records progress from STATUS mtime / lane git commits, configurable `lanes.stallTimeoutMinutes` and `lanes.stallGraceAfterProgressMinutes`, tests with stub worker.

**Out of scope (Phase 3):** multi-lane scheduling, `/spine-resume`, atomic retry (§18.5), full zombie registry repair, progress-aware kill across parallel lanes.

**Success:** During `spine batch start`, heartbeats append while work progresses; stall kill is suppressed when STATUS or lane branch commits advance; preflight + **51+** tests pass; first recommended real pi dogfood batch after TP-012.

## Dependencies

- **TP-012** — single-lane batch engine on `main`

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md` — Option B; TP-013 is next

**Tier 3:**
- `docs/PRD.md` — FR-WORK-09, FR-BATCH-07, §18.1 `LaneStale`, §18.4 progress-aware stall, journal `lane.heartbeat`
- `src/batch/engine.mjs`, `src/batch/worker-host.mjs`, `src/batch/journal.mjs`, `src/batch/state.mjs`
- `docs/incidents/20260531-phase0-taskplane-batch.md` — stall false positives

## Environment

- **Workspace:** pi-spine repo root
- **Requires:** Node ≥22, git; `pi` on PATH for real dogfood (CI may use `SPINE_WORKER_STUB=1`)

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/engine.mjs`
- `src/batch/state.mjs`
- `src/batch/journal.mjs`
- `.spine/spine-config.json` schema (stall/heartbeat keys) if needed
- `tests/batch/heartbeat.test.mjs` (new)
- `README.md` (heartbeat / stall operator notes)

## Steps

### Step 0: Preflight

- [ ] Read FR-WORK-09, FR-BATCH-07, PRD §18.4
- [ ] Confirm `spine preflight` passes on clean `main`

### Step 1: Journal + state fields

- [ ] Add `lane.heartbeat` and `lane.stall_warning` event writers
- [ ] Persist `lastHeartbeatAt` on lane records in batch-state schema v1

### Step 2: Worker host progress signals

- [ ] Poll STATUS.md mtime and lane-branch commits during `runWorker`
- [ ] Emit heartbeat on step completion or every 10 minutes during long steps

### Step 3: Engine stall policy (single lane)

- [ ] Before timeout kill, write `lane.stall_warning` with last signals
- [ ] Respect grace after progress per §18.4

### Step 4: Tests and docs

- [ ] `tests/batch/heartbeat.test.mjs` with stub worker
- [ ] README: stall/heartbeat configuration
- [ ] Update STATUS.md and CONTEXT.md when done

## Completion Criteria

- [ ] Heartbeats visible in journal and batch-state during batch run
- [ ] Stall kill deferred when progress signals are fresh
- [ ] `npm test` and `spine preflight` pass on clean tree

## Do NOT

- Implement multi-lane heartbeat aggregation (Phase 3)
- Implement `/spine-resume` or atomic retry in this task
