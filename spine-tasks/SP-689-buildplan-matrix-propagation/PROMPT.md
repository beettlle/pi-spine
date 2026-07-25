# Task: SP-689 — Propagate matrix fields through buildPlan

**Created:** 2026-07-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Copy already-parsed `matrix`/`matrixColumns` into `tasksById`; planner expansion already exists when fields are present (HIGH callers via startBatch/sequence — keep change minimal).
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #226 — `buildPlan` must copy `matrix` and `matrixColumns` from the parsed packet into `tasksById` so `assignLanesToWaves` expands virtual `SP-X[rowId]` sub-lanes. Extend tests so a **real** `buildPlan` path expands matrix rows (not hand-built `tasksById`). Update the runbook caveat once plan output matches docs. Optionally retire or clearly deprecate the duplicate `assignLanesToWaves` in `src/planner/lanes.mjs` if it remains dead — do not change packing semantics beyond enabling existing expansion.

**Hard requirement:** Production `spine plan` / `buildPlan` must supply matrix fields — not only unit tests that inject them manually.

## Dependencies

- **None**

## Context to Read First

- `src/planner/index.mjs` — `buildPlan` `tasksById` assembly (~L56–63)
- `src/planner/waves.mjs` — matrix expansion when `task.matrix` present
- `src/tasks/packet/parse-prompt.mjs` — already parses `matrix` / `matrixColumns`
- `src/planner/lanes.mjs` — duplicate `assignLanesToWaves` (dedupe or deprecate)
- `tests/planner/plan-matrix.test.mjs`
- `docs/adoption/operator-runbook.md` §2.4
- GitHub #226

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
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/planner/plan-matrix.test.mjs` |
| fileScopeMustChange | `src/planner/index.mjs`, `tests/planner/plan-matrix.test.mjs`, `docs/adoption/operator-runbook.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm `loadTaskPacket` / parse-prompt already expose `matrix` / `matrixColumns`
- [ ] Confirm `buildPlan` omits those fields from `tasksById`
- [ ] Confirm `plan-matrix.test.mjs` currently injects fields manually

### Step 1: Propagate matrix into buildPlan

- [ ] Copy `matrix` and `matrixColumns` from parsed prompt into `tasksById[taskId]`
- [ ] Ensure per-row file-scope substitution still runs before packing (existing waves path)
- [ ] Deduplicate or clearly deprecate duplicate `assignLanesToWaves` in `lanes.mjs` if still unused by production — prefer thin re-export over divergent copy

### Step 2: Testing & Verification

- [ ] Extend tests so **real** `buildPlan` (fixture tasks root with `## Matrix`) expands `SP-X[rowId]` virtual sub-lanes when row scopes are disjoint
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` §2.4 caveat to match real plan output
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — matrix plan packing caveat §2.4

**Check If Affected:**
- None

## Completion Criteria

- [ ] `buildPlan` propagates `matrix` / `matrixColumns`
- [ ] Real `buildPlan` regression shows virtual sub-lanes
- [ ] Runbook matches behavior
- [ ] No divergent duplicate packing logic left unexplained

## Do NOT

- Change engine first-class row scheduling (#228)
- Rewrite wave packing algorithms beyond enabling existing expansion
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-689): propagate matrix fields through buildPlan (#226)`
