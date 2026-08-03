# Task: SP-697 — First-class matrix row lane competitors (schedule core)

**Created:** 2026-08-03
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Replaces nested parent-held matrix fan-out with rows competing for the global `lanes.maxParallel` pool (new scheduling pattern; touches matrix-run + engine-lanes).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Partial #228 — Stop holding one parent lane while spawning nested `runConcurrent` workers. After planner expansion is enabled (SP-696), matrix rows must be schedulable units that compete for the global `lanes.maxParallel` pool: each active row gets a distinct `laneNumber` / worktree; do **not** occupy a parent lane for the entire sweep while also running inner workers. Parent task ID remains the aggregation / dependency identity (aggregation + docs land in SP-698).

**Hard requirement:** An N-row matrix with `maxParallel=M` must run `min(N,M)` rows on **distinct** lanes concurrently (plan/runtime identity may still use parent until SP-696 lands — this task teaches the engine to schedule row competitors; do not require `buildPlan` virtual IDs in this packet).

## Dependencies

- **Task:** SP-695 (serialize `engine-lanes.mjs` — plan-review wire lands before matrix schedule rewrite)

## Context to Read First

- `src/batch/engine-lanes/matrix-run.mjs` — `runMatrixTaskOnLane`, `matrixRowConcurrencyLimit` (SP-690 interim)
- `src/batch/engine-lanes/matrix.mjs` — worktree helpers, `runConcurrent`, setup hook
- `src/batch/engine-lanes.mjs` — matrix branch in `runTaskOnLane` (after SP-695 plan-review wire)
- `src/planner/waves.mjs` — virtual sub-lane packing (read-only for this task)
- `tests/batch/matrix-execution.test.mjs`
- GitHub #228 (schedule ACs); epic #225
- Parent split: SP-690 — interim nested throttle superseded by this work
- Manifest: `spine-tasks/_authoring/release-v2.12.3/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `src/batch/engine-lanes/matrix.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/matrix-execution.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix-run.mjs`, `src/batch/engine-lanes.mjs`, `tests/batch/matrix-execution.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current path: parent lane held + nested `runConcurrent` + SP-690 remaining-slot throttle
- [ ] Confirm #224 `worktreeSetupHook` still runs per row worktree today (preserve in new model)
- [ ] Confirm tests that assert nested throttle / parent-lane identity

### Step 1: Schedule matrix rows as lane-pool competitors

- [ ] Replace nested parent-held fan-out so active rows compete for global `lanes.maxParallel` (no double-count parent + rows)
- [ ] Assign distinct `laneNumber` / worktree per active row (`lane-{n}-…` with real lane diversity)
- [ ] Preserve per-row `worktreeSetupHook` behavior (#224)
- [ ] Keep parent task ID as the batch-state / dependency identity for this task (aggregation semantics refined in SP-698)
- [ ] Leave `buildPlan` matrix propagation to SP-696 — do not re-enable planner virtual rows here

### Step 2: Testing & Verification

- [ ] Tests: N-row matrix with `maxParallel=M` runs `min(N,M)` rows on distinct lanes
- [ ] Global in-flight ≤ `lanes.maxParallel` (supersedes nested throttle for the happy path)
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code

### Step 3: Documentation & Delivery

- [ ] Create `.DONE` (runbook updates deferred to SP-698)

## Documentation Requirements

**Must Update:**
- None (docs in SP-698)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-698 owns the §2.4 rewrite

## Completion Criteria

- [ ] Rows compete for the global lane pool on distinct lanes
- [ ] Parent lane is not held for the whole sweep while also nesting full concurrency
- [ ] #224 hook preserved per row worktree
- [ ] Matrix execution tests green for parallel distinct lanes
- [ ] No `buildPlan` matrix re-propagation in this task

## Do NOT

- Re-enable `buildPlan` matrix/`matrixColumns` propagation (SP-696)
- Implement per-row status/retry/cancel APIs (#230) or maxFailedIndexes (#231)
- Complete runbook rewrite (SP-698)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-697): schedule matrix rows as first-class lane competitors (#228)`
