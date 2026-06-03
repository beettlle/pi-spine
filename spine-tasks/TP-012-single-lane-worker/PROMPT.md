# Task: TP-012 — Single-lane batch engine (Phase 2)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Introduces pi-spine-owned batch execution (worktree + worker spawn + state/journal). Wrong merge or state writes can orphan repos or lose work; must stay single-lane and fail loud.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Mission

Deliver the **minimal pi-spine batch engine** for **one lane, one task per batch** (PRD Phase 2, Option B orchestration). Operators run `spine batch start <scope>` (and `/spine <scope>`) instead of Taskplane `/orch` for dogfood.

**In scope:** preflight-gated start, `.spine/batch-state.json` (schema v1), append-only journal, git worktree + `task/...` branch, pi worker subprocess in worktree, `.DONE` detection, deterministic git merge lane → `orch/{batchId}`, terminal batch phase, reconciliation-friendly records.

**Out of scope (defer to TP-013+):** multi-lane parallelism, FR-WORK-09 heartbeat, progress-aware stall kill, atomic retry/resume, reviewer sessions, LLM merge agents, integrate gate, dashboard.

**Success:** From a clean `main`, `spine batch start <one-task-id>` runs that task to `.DONE`, merges to orch branch, leaves batch `completed` (or `failed` with clear diagnosis), **49+ tests pass**, and a documented dogfood command works without Taskplane.

## Dependencies

- **TP-011** — CI green; git test fixtures on `main`

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md` — Option B; Phase 2/3 priority

**Tier 3:**
- `docs/PRD.md` — §7.5 FR-WORK-01–08, §7.8 FR-BATCH-01–03/08, §9.4 layout, §10.1 batch state, §11 journal, §17.3 sequence, Phase 2 row §23
- `src/batch/reconcile.mjs`, `src/batch/lifecycle.mjs` — existing spine batch semantics
- `src/planner/index.mjs` — wave plan for scope resolution
- `bin/spine-preflight.mjs` — must run before start
- `extensions/spine/slash-commands.ts` — `/spine` stub today
- `docs/incidents/20260531-phase0-taskplane-batch.md` — stall/limbo lessons (design monitor accordingly)
- Taskplane `lane-runner.ts` / `agent-host.ts` (read-only reference under `~/.pi/agent/.../taskplane/`) — patterns only; do not depend on Taskplane at runtime

## Environment

- **Workspace:** pi-spine repo root
- **Requires:** Node ≥22, git (worktrees), `pi` on PATH for worker spawn
- **Dogfood:** serial only — **never** start Taskplane `/orch` and `spine batch start` on the same repo concurrently (PRD §22.1)

## File Scope

- `src/batch/engine.mjs` (new — single-lane orchestration loop)
- `src/batch/worktree.mjs` (new — provision/cleanup)
- `src/batch/worker-host.mjs` (new — spawn/monitor pi worker)
- `src/batch/state.mjs` (new — read/write `.spine/batch-state.json` schema v1)
- `src/batch/journal.mjs` (new — append `journal/events.jsonl`)
- `bin/spine-batch.mjs` (extend — `start` subcommand)
- `bin/spine.mjs` (wire `spine batch start`)
- `extensions/spine/slash-commands.ts` (implement `/spine` batch start when preflight passes)
- `tests/batch/engine.test.mjs` (new)
- `tests/helpers/git-fixture.mjs` (reuse for engine tests)
- `README.md` (Phase 2 batch start section)

## Steps

### Step 0: Preflight

- [ ] Read FR-WORK-01–08, FR-BATCH-01–03, FR-BATCH-08, PRD §9.4–§11
- [ ] Confirm `spine preflight` passes on clean `main`
- [ ] Prototype: `git worktree add` + `pi` worker invocation manually once (document flags in STATUS Discoveries)
- [ ] Confirm worktree root convention: `.worktrees/spine-{batchId}/lane-1` (PRD §9.4)

### Step 1: Batch state + journal primitives

> **Plan-review checkpoint** — agree on schema v1 fields and journal event types before engine loop.

- [ ] Create `src/batch/state.mjs`: `createBatchState`, `loadBatchState`, `saveBatchState`, `assertNoActiveBatch` (FR-BATCH-03)
- [ ] Batch ID format `{YYYYMMDD}T{HHmmss}` UTC (FR-BATCH-01); phases use PRD v1 set: `planning` | `running` | `paused` | `completed` | `failed` | `aborted` (FR-BATCH-02)
- [ ] Create `src/batch/journal.mjs`: append-only `.spine/runtime/{batchId}/journal/events.jsonl` with at minimum: `batch.started`, `lane.provisioned`, `task.started`, `task.completed`, `task.failed`, `batch.merge_started`, `batch.merge_completed`, `batch.completed`, `batch.failed`
- [ ] Persist under `.spine/` only for pi-spine batches (not `.pi/batch-state.json`)
- [ ] Unit tests for state round-trip and journal append order

**Artifacts:**
- `src/batch/state.mjs`, `src/batch/journal.mjs`, `tests/batch/state-journal.test.mjs` (or combined in engine tests)

### Step 2: Worktree provisioner

- [ ] Create `src/batch/worktree.mjs`: `provisionLaneWorktree({ projectRoot, batchId, laneNumber, orchBranch, taskBranch })`
  - Create orch branch from `baseBranch` if missing: `orch/{batchId}` (or `orch/spine-{batchId}` — pick one convention, document in code)
  - `git worktree add .worktrees/spine-{batchId}/lane-1 -b task/spine-lane-1-{batchId} {orchBranch}`
- [ ] `removeLaneWorktree` best-effort cleanup on failure
- [ ] Tests with `initGitRepo` helper: worktree exists, branch checked out, task folder path resolvable

**Artifacts:**
- `src/batch/worktree.mjs`

### Step 3: Worker host (pi subprocess)

> **Plan-review checkpoint** — document exact `pi` argv/env, how worker receives `PROMPT.md` path, and exit codes.

- [ ] Create `src/batch/worker-host.mjs`: `runWorker({ worktreePath, taskFolder, agentPromptPath })`
  - Spawn `pi` (or documented wrapper) with `.spine/agents/worker.md` composed per FR-WORK-08
  - Worker cwd = worktree; task packet copied or symlinked into worktree `taskplane-tasks/...` if needed
  - Poll for `.DONE` in task folder (FR-WORK-01 terminal signal)
  - Enforce timeout guard (configurable, default 60 min) — on timeout exit non-zero and journal `task.failed` with `stall_timeout` classification (full §18.4 deferred to TP-013)
  - Do **not** require reviewer for review level 0; for level > 0, fail closed with clear message (FR-REV-06 partial — defer full reviewer to Phase 4)
- [ ] Map worker exit + `.DONE` → task `succeeded` | `failed` in batch state

**Artifacts:**
- `src/batch/worker-host.mjs`

### Step 4: Single-lane engine loop

- [ ] Create `src/batch/engine.mjs`: `startBatch({ projectRoot, scope, options })`
  1. Run `runBatchPreflight` — abort if not ok (FR-BATCH-11)
  2. `buildPlan` from planner — **reject** if plan requires >1 lane or >1 task in wave 0 for v1 (fail loud: "TP-012 supports exactly one task; use spine plan to narrow scope")
  3. Create batch state `planning` → `running`, write `.spine/batch-state.json`, journal `batch.started`
  4. Provision worktree + lane record in state
  5. `runWorker` for the single task
  6. On success: journal `task.completed`, update counters, call `mergeLaneToOrch` (deterministic `git merge` in parent repo / orch worktree — **no LLM merge agent**)
  7. Set phase `completed` or `failed`; set `endedAt`; journal terminal event
- [ ] `mergeLaneToOrch`: merge `task/spine-lane-1-{batchId}` into `orch/{batchId}`; record `mergeResults` entry `{ waveIndex: 0, status: "succeeded" }`
- [ ] On failure: leave state for `spine status --diagnose`; do not delete batch-state without archive (reuse lifecycle archive patterns where appropriate)

**Artifacts:**
- `src/batch/engine.mjs`

### Step 5: CLI and slash commands

- [ ] Extend `bin/spine-batch.mjs`: subcommand `start <scope>` with `--json`, `--dry-run` (plan + preflight only)
- [ ] Wire `spine batch start` in `bin/spine.mjs` help/examples
- [ ] Update `extensions/spine/slash-commands.ts`: when preflight passes and no active batch, `/spine <scope>` invokes `spine batch start` (replace Phase 2+ stub message)
- [ ] Keep `/spine-pause`, `/spine-resume`, `/spine-abort` as stubs that point to Phase 3 unless trivial wiring is safe

**Artifacts:**
- `bin/spine-batch.mjs`, `bin/spine.mjs`, `extensions/spine/slash-commands.ts`

### Step 6: Engine test suite

- [ ] `tests/batch/engine.test.mjs`: temp repo via `initGitRepo`; tiny task packet with 1-step PROMPT; mock worker or use fast no-op worker script if `pi` unavailable in CI
- [ ] Assert: batch-state created, journal contains `batch.started` + `batch.completed`, `.DONE` respected, mergeResults populated
- [ ] CI strategy: if `pi` missing in GitHub Actions, use `SPINE_WORKER_STUB` env to run a script that touches `.DONE` (document in README + test skip message)
- [ ] Run `npm test` twice — all pass

**Artifacts:**
- `tests/batch/engine.test.mjs`

### Step 7: Documentation & dogfood

- [ ] README: "Running a batch (Phase 2)" — `spine preflight`, `spine batch start TP-xxx`, expected directories, recovery via `spine status` / `spine batch dismiss`
- [ ] Update `taskplane-tasks/CONTEXT.md`: TP-012 staged → done after merge; Next Task ID **TP-013**
- [ ] Log discoveries (pi spawn argv, CI stub) in STATUS.md
- [ ] **Dogfood note:** recommend first real batch be **TP-013** (heartbeat) or a tiny `SP-001` smoke task — not a large `/orch` parallel batch

## Documentation Requirements

**Must Update:**
- `README.md` — Phase 2 batch start
- `taskplane-tasks/CONTEXT.md` — after completion

**Check If Affected:**
- `docs/PRD.md` — only if implementation diverges from §9.4 paths (add amendment note in STATUS)

## Completion Criteria

- [ ] `spine batch start <single-task>` works on clean repo without Taskplane
- [ ] Active state in `.spine/batch-state.json`; journal under `.spine/runtime/{batchId}/`
- [ ] Worker runs in worktree; task completes with `.DONE` and step commits (FR-WORK-02/03 best-effort in dogfood)
- [ ] Lane branch merged to orch branch deterministically
- [ ] `spine status` reports correct terminal diagnosis after batch
- [ ] Typecheck + full `npm test` pass (with documented CI stub if needed)
- [ ] No regression to reconciliation, preflight, planner, lifecycle CLIs

## Git Commit Convention

- **Step completion:** `feat(TP-012): complete Step N — description`

## Do NOT

- Implement multi-lane waves or `maxParallel > 1` (Phase 3)
- Implement `/spine-retry-task`, pause/resume engine, or progress-aware stall (Phase 3 — TP-013+)
- Write to `.pi/batch-state.json` for pi-spine-native batches
- Use Taskplane merge agents or `/orch` as a runtime dependency
- Start TP-013 heartbeat in this task (explicitly TP-013)

---

## Amendments (Added During Execution)
