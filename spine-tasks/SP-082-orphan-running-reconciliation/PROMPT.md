# Task: SP-082 — Orphan running state reconciliation

**Created:** 2026-06-03
**Size:** L

## Review Level: 2 (Plan + Code)

**Assessment:** searchATon batch `20260603T185308` left `phase: running` + stale `workerPid` after engine/worker died mid-resume — reconcile returns plain `running`.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Mission

Detect **orphan running batches**: when batch-state says `running` but batch engine PID and/or lane `workerPid` are dead and journal has no terminal event, reconciliation must **not** report `running`. Transition to actionable diagnosis (`engine_orphaned` or `needs_retry`) with `suggestedCommand: spine batch retry <id>` or `spine batch abort`.

Persist **batch engine PID** in batch-state when detached engine spawns; verify liveness on diagnose/reconcile.

**Bug report:** searchATon Wave 8 batch `20260603T185308` — zombie after `task.started` + `lane.heartbeat` with dead workerPid.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `src/batch/reconcile.mjs` — `deriveDiagnosis`, `classifyTasks`
- `src/batch/diagnosis.mjs` — FR-BATCH-13 taxonomy
- `src/batch/detached-start.mjs` — `spawnDetachedBatchEngine` (enginePid not persisted today)
- `src/batch/state.mjs` — batch-state schema
- `src/batch/lifecycle.mjs` — `hasLiveLanes` (state-only, no PID check)
- `src/batch/abort.mjs` — existing `workerPid` kill pattern
- `docs/PRD.md` §18.3 diagnosis taxonomy

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/state.mjs`
- `src/batch/engine.mjs` (engine writes/clears enginePid if attached path)
- `src/process/liveness.mjs` (new — `isProcessAlive(pid)`)
- `tests/batch/orphan-reconcile.test.mjs` (new)
- `tests/batch/detached-start.test.mjs`
- `docs/PRD.md` (if adding `engine_orphaned` diagnosis)

## Steps

### Step 0: Preflight

- [ ] Reproduce per bug sketch: fail-fast launch script → detached resume → kill engine after `phase: running`
- [ ] Confirm today `spine status --diagnose` returns `running`

### Step 1: Process liveness + enginePid persistence

> **Plan-review checkpoint**

- [ ] Add `isProcessAlive(pid)` (signal 0 / `kill -0` equivalent, cross-platform)
- [ ] Persist `resilience.enginePid` (or top-level `enginePid`) + `engineStartedAt` in batch-state when detached engine spawns; clear on terminal batch phases
- [ ] Engine clears enginePid on normal exit
- [ ] Call `spine_review_step` after this step

### Step 2: Orphan detection in reconcile

> **Code review checkpoint**

- [ ] When `phase === "running"` and task `status === "running"`: if `workerPid` set and not alive → orphan lane
- [ ] If `enginePid` set and not alive and no recent journal terminal event → orphan engine
- [ ] Optional: heartbeat age > `stallTimeout` with dead PID → same classification
- [ ] Derive diagnosis `engine_orphaned` (extend FR-BATCH-13) **or** `needs_retry` with explicit headline — never plain `running`
- [ ] `suggestedCommand`: `spine batch retry <taskId>` or `spine batch abort`
- [ ] Optional auto-repair flag (future): set task failed + journal `lane.died` synthetic — document as out-of-scope unless trivial
- [ ] Call `spine_review_step` after this step

### Step 3: Testing & Verification

- [ ] Unit test: dead workerPid + running task → not `running` diagnosis
- [ ] Unit test: dead enginePid mid-resume fixture
- [ ] Integration test matching reproduction sketch
- [ ] Dashboard parity test updated if diagnosis added
- [ ] FULL suite + coverage ≥77%

### Step 4: Documentation & Delivery

- [ ] Operator runbook: orphan running troubleshooting
- [ ] Discoveries in STATUS.md

## Completion Criteria

- [ ] No indefinite `phase: running` + `task: running` when worker and engine PIDs both dead
- [ ] Diagnose returns actionable command, not `running`

## Git Commit Convention

- `feat(SP-082): complete Step N — description`

## Do NOT

- Auto-dismiss batches without operator-visible diagnosis
- Break legitimate long-running workers (only flag when PID dead or stall exceeded)

---

## Amendments (Added During Execution)
