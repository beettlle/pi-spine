# Task: SP-696 — Re-propagate matrix fields through buildPlan

**Created:** 2026-08-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Re-applies SP-689's `buildPlan` matrix/`matrixColumns` propagation after SP-697/SP-698 teach the engine to schedule row competitors (avoids the v2.12.1 `task_not_found` mismatch).
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Closes #226 — `buildPlan` must copy `matrix` and `matrixColumns` from the parsed packet into `tasksById` so `assignLanesToWaves` expands virtual `SP-X[rowId]` sub-lanes. Extend tests so a **real** `buildPlan` path expands matrix rows (not hand-built `tasksById`). Update the runbook caveat once plan output matches docs and first-class row scheduling (SP-697/SP-698).

**Hard requirement:** Do **not** ship this without SP-697/SP-698 — SP-690 reverted the same propagation in v2.12.1 because the engine could not schedule virtual row IDs. SP-689 remains `.DONE`; this is a **new** packet that re-applies propagation after engine readiness.

## Dependencies

- **Task:** SP-698 (first-class row schedule + aggregation must land before planner virtual rows)

## Context to Read First

- `src/planner/index.mjs` — `buildPlan` `tasksById` assembly (matrix fields still omitted)
- `src/planner/waves.mjs` — matrix expansion when `task.matrix` present
- `src/tasks/packet/parse-prompt.mjs` — already parses `matrix` / `matrixColumns`
- `src/planner/lanes.mjs` — duplicate `assignLanesToWaves` if still present
- `tests/planner/plan-matrix.test.mjs`
- `docs/adoption/operator-runbook.md` §2.4
- `spine-tasks/SP-689-buildplan-matrix-propagation/PROMPT.md` — prior attempt
- `spine-tasks/SP-690-matrix-nested-maxparallel-throttle/PROMPT.md` — Amendment that reverted propagation
- GitHub #226
- Parent split: SP-689 — first propagation attempt (reverted by SP-690)
- Manifest: `spine-tasks/_authoring/release-v2.12.3/manifest.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/index.mjs`
- `src/planner/lanes.mjs`
- `tests/planner/plan-matrix.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/planner/plan-matrix.test.mjs tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/planner/index.mjs`, `tests/planner/plan-matrix.test.mjs`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-698 `.DONE` / first-class row scheduling integrated
- [ ] Confirm `buildPlan` still omits `matrix` / `matrixColumns` from `tasksById`
- [ ] Confirm SP-690 left planner tests asserting parent-only identity

### Step 1: Propagate matrix into buildPlan

- [ ] Copy `matrix` and `matrixColumns` from parsed prompt into `tasksById[taskId]`
- [ ] Ensure per-row file-scope substitution still runs before packing
- [ ] Deduplicate or clearly deprecate duplicate `assignLanesToWaves` in `lanes.mjs` if still unused
- [ ] Confirm production matrix E2E still pass with virtual row plan IDs (engine from SP-697/SP-698)

### Step 2: Testing & Verification

- [ ] Extend tests so **real** `buildPlan` expands `SP-X[rowId]` virtual sub-lanes when row scopes are disjoint
- [ ] Include matrix execution regression in contract command (no `task_not_found` recurrence)
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code

### Step 3: Documentation & Delivery

- [ ] Update runbook §2.4 so plan output matches docs (virtual sub-lanes)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — planner packing matches virtual sub-lane reality

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] `buildPlan` propagates `matrix` / `matrixColumns`
- [ ] Real `buildPlan` regression shows virtual sub-lanes
- [ ] Matrix execution does not regress to `task_not_found`
- [ ] Runbook matches behavior
- [ ] #226 closable

## Do NOT

- Clear or rewrite SP-689 `.DONE` history
- Ship without SP-698 dependency satisfied
- Implement #229–#232
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-696): re-propagate matrix fields through buildPlan (#226)`
