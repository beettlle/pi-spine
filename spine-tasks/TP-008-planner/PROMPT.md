# Task: TP-008 — Phase 1 planner and spine plan CLI

**Created:** 2026-05-31
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Core scheduling engine plus CLI and slash integration; wave/lane mistakes propagate to every batch and preflight gate.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Implement Phase 1 planner (FR-SCHED-01, FR-SCHED-02, FR-SCHED-03, FR-SCHED-04, FR-SCHED-06): build dependency DAG, topological waves, lane assignment with file-scope disjointness and `lanes.maxParallel`, expose `spine plan` CLI and `/spine-plan` slash command, write plan artifacts to `.spine/runtime/plan-{timestamp}.json`, and **complete FR-BATCH-11** by replacing TP-006's `runPreflightPlanCheck` stub to print the wave plan during preflight.

## Dependencies

- **TP-006** — batch preflight module and `runPreflightPlanCheck` stub hook
- **TP-007** — Taskplane parsers and dependency merge API

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `pi-spine-PRD.md` — §7.3 FR-SCHED, §7.9 FR-BATCH-11, §15.1 `/spine-plan`, §15.2 `spine plan`
- `src/compat/taskplane/index.mjs` — task discovery and deps (TP-007)
- `bin/spine-preflight.mjs` — preflight hook to complete (TP-006)
- Taskplane planner output shape for `/orch-plan` comparison (M5 success metric)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/**` (new)
- `bin/spine-plan.mjs` (new)
- `bin/spine-preflight.mjs`
- `bin/spine.mjs`
- `extensions/spine/slash-commands.ts`
- `tests/planner/**` (new)
- `tests/spine-preflight.test.mjs` (extend)

## Steps

### Step 0: Preflight

- [ ] Read FR-SCHED-01 through FR-SCHED-04 and FR-SCHED-06
- [ ] Confirm TP-007 parser exports needed fields (task id, deps, file scope)
- [ ] Confirm TP-006 `runPreflightPlanCheck` stub signature and import path

### Step 1: Implement planner core

> **Plan-review checkpoint** — confirm wave JSON shape and lane overlap algorithm before CLI wiring.

- [ ] Create `src/planner/graph.mjs` — FR-SCHED-01: build directed graph from merged deps; topological sort into waves
- [ ] Create `src/planner/cycles.mjs` — FR-SCHED-02: detect cycles; print cycle path in error
- [ ] Create `src/planner/lanes.mjs` — FR-SCHED-03/04: greedy lane assignment by file-scope disjointness; respect `lanes.maxParallel` from spine config
- [ ] Create `src/planner/index.mjs` exporting `buildPlan({ scope, config, tasksRoot })` returning waves, lanes, and metadata

**Artifacts:**
- `src/planner/graph.mjs` (new)
- `src/planner/cycles.mjs` (new)
- `src/planner/lanes.mjs` (new)
- `src/planner/index.mjs` (new)

### Step 2: Plan scope resolution

- [ ] Implement scope parsing — FR-SCHED-06: support `all`, glob paths, and explicit task IDs
- [ ] Filter discovered tasks to scope before graph build
- [ ] Add unit tests for each scope mode in `tests/planner/scope.test.mjs`

**Artifacts:**
- `src/planner/scope.mjs` (new)
- `tests/planner/scope.test.mjs` (new)

### Step 3: spine plan CLI and /spine-plan slash command

- [ ] Create `bin/spine-plan.mjs` with human-readable wave/lane summary and `--json` stdout mode
- [ ] Wire `spine plan <scope>` subcommand in `bin/spine.mjs`
- [ ] Replace `/spine-plan` stub in `extensions/spine/slash-commands.ts` to invoke planner and notify summary
- [ ] Write plan artifact — FR-SCHED-05: `.spine/runtime/plan-{timestamp}.json` on plan runs (create directory if needed)

**Artifacts:**
- `bin/spine-plan.mjs` (new)
- `bin/spine.mjs` (modified)
- `extensions/spine/slash-commands.ts` (modified)

### Step 4: Complete FR-BATCH-11 preflight plan check

- [ ] Replace TP-006 `runPreflightPlanCheck` stub in `bin/spine-preflight.mjs` to call planner with scope `all`
- [ ] Print wave plan summary during `spine preflight` (same shape as `spine plan all`)
- [ ] Extend `tests/spine-preflight.test.mjs` to assert plan check runs and prints wave count

**Artifacts:**
- `bin/spine-preflight.mjs` (modified)
- `tests/spine-preflight.test.mjs` (modified)

### Step 5: Planner test suite

- [ ] Add `tests/planner/graph.test.mjs` — wave ordering and cycle detection fixtures
- [ ] Add `tests/planner/lanes.test.mjs` — overlapping file scopes force extra lanes; maxParallel respected
- [ ] Add integration test comparing plan for `taskplane-tasks/` deps against expected wave 0 = TP-006||TP-007, wave 1 = TP-008
- [ ] Run targeted tests: `node --test tests/planner/*.test.mjs tests/spine-preflight.test.mjs`

**Artifacts:**
- `tests/planner/**` (new/extended)

### Step 6: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Run `npm test` (full suite)
- [ ] Manual smoke: `node bin/spine.mjs plan all` and `node bin/spine.mjs preflight` — log wave output in STATUS.md

### Step 7: Documentation & Delivery

- [ ] Update README.md with `spine plan` and `/spine-plan` usage
- [ ] Mark GAP-PREFLIGHT-01 **Closed** in `docs/compatibility/taskplane-gap-list.md`
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — planner CLI, plan artifact path, preflight wave plan output
- `docs/compatibility/taskplane-gap-list.md` — GAP-PREFLIGHT-01 → **Closed** (FR-BATCH-11 complete)

## Completion Criteria

- [ ] FR-SCHED-01, 02, 03, 04, 06 implemented with passing tests
- [ ] FR-BATCH-11 wave plan printing completed via preflight integration
- [ ] Plan artifacts written to `.spine/runtime/plan-{timestamp}.json`
- [ ] Typecheck and tests pass

## Git Commit Convention

- **Step completion:** `feat(TP-008): complete Step N — description`

## Do NOT

- Start batch execution, worktrees, or worker sessions (Phase 2+)
- Modify task parser semantics beyond planner consumption (TP-007 owns parsers)
- Remove preflight checks added in TP-006 — only replace the plan stub

---

## Amendments (Added During Execution)
