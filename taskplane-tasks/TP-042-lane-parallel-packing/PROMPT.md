# Task: TP-042 — Fix lane packing vs parallel execution

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Closes a scheduler/engine mismatch discovered in Phase 8 dogfood (batch `20260602T194520`): disjoint-scope tasks packed into one virtual lane but executed in parallel on one worktree. Touches planner, batch engine, tests, and dashboard lane display.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-042-lane-parallel-packing/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Fix **lane packing vs parallel execution** so waves, lanes, and the dashboard mean different things again (FR-SCHED-03/04, NFR-OBS-04).

**Problem (dogfood batch `20260602T194520`, Wave 2):**
- Planner assigned TP-034, TP-038, TP-041 to **one virtual lane** because their file scopes are disjoint.
- Greedy packing in `src/planner/lanes.mjs` treats "no overlap" as "reuse virtual lane 0" (serial reuse intent).
- Engine runs all tasks in `tick.lanes[laneInTick]` via `Promise.all` on the **same worktree** → parallel workers collide.
- Dashboard **Lanes** table shows cumulative `lane.taskIds` for the batch, which looks like "same lane = same wave."

**Correct behavior:**
1. **Disjoint file scopes → distinct virtual lanes** (parallel up to `lanes.maxParallel`).
2. **Overlapping file scopes → same virtual lane** (serialized on one worktree).
3. **Engine:** never `Promise.all` multiple workers on the same physical lane/worktree; parallelize only across distinct physical lane numbers (or await serially within a lane slot).
4. **Dashboard:** lane row distinguishes **active tick tasks** vs **batch lane assignment**; show wave index where cheap.

**Regression fixture:** `spine plan TP-034 TP-038 TP-041` must show **3 lanes** in tick 0 (not `Lane 0: all three`).

**Out of scope:** changing dependency wave semantics; multi-repo segments; `createAgentSession` workers.

**Success:** planner + engine tests prove disjoint tasks use separate lanes; overlapping tasks serialize; dashboard no longer implies lane === wave; full suite green.

## Dependencies

- **TP-019** — multi-lane engine + worktree model
- **TP-026** — dashboard snapshot/view (lane table)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`
- `docs/PRD.md` — FR-SCHED-03, FR-SCHED-04, §16 dashboard parity

**Tier 3:**
- `src/planner/lanes.mjs` — greedy virtual-lane packing (bug at overlap check)
- `src/batch/engine.mjs` — tick loop + `Promise.all(tickRuns)` (~L805–859)
- `src/dashboard/snapshot.mjs`, `src/dashboard/view.mjs`, `src/dashboard/public/dashboard.js` — lane rows
- `docs/incidents/20260531-phase0-taskplane-batch.md` — why parallel same-worktree is unsafe

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/planner/lanes.mjs`
- `src/batch/engine.mjs`
- `tests/planner/lanes-parallel.test.mjs` (new)
- `tests/batch/engine-lane-execution.test.mjs` (new)
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/dashboard.css` (if column layout changes)
- `tests/dashboard/snapshot-lanes.test.mjs` (new or extend existing)
- `docs/compatibility/taskplane-gap-list.md` (add GAP entry + close when done)
- `README.md` — brief wave vs lane note under batch planning

## Steps

### Step 0: Preflight

- [ ] Reproduce: `node bin/spine.mjs plan TP-034 TP-038 TP-041` → confirm all three on `Lane 0` today
- [ ] Read engine tick loop; confirm `Promise.all` on same `laneNumber`
- [ ] Baseline: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 1: Planner — disjoint scopes get distinct virtual lanes

> **Plan-review checkpoint**

- [ ] Change `assignLanesToWaves` greedy rule:
  - **If task overlaps** an existing virtual lane's accumulated paths → assign to that virtual lane (serial).
  - **If disjoint from all virtual lanes** → **new** virtual lane (parallel), do **not** append to lane 0 for packing.
- [ ] Preserve `queueExcess` tick math when `virtualLaneCount > maxParallel`.
- [ ] Add `tests/planner/lanes-parallel.test.mjs`:
  - TP-034/038/041 fixture → `virtualLaneCount === 3`, three `laneInTick` slots in tick 0
  - Synthetic overlapping scopes (shared `bin/spine.mjs`) → same virtual lane
  - `spine plan` human output lists three lanes for the fixture

**Artifacts:** `src/planner/lanes.mjs`, `tests/planner/lanes-parallel.test.mjs`

### Step 2: Engine — serialize same physical lane, parallelize across lanes

> **Code review checkpoint**

- [ ] Refactor tick execution in `src/batch/engine.mjs`:
  - Group `tickRuns` by physical `laneNumber`
  - **Across lanes:** `Promise.all` (parallel worktrees)
  - **Within one lane:** sequential `await` (one worker at a time per worktree)
- [ ] Journal/log when serializing multiple tasks on one lane (debug-friendly, no secrets)
- [ ] Add `tests/batch/engine-lane-execution.test.mjs` with stub workers:
  - Mock/spy that same lane never has overlapping worker spawns
  - Two-lane plan runs in parallel; two tasks one lane run serially

**Artifacts:** `src/batch/engine.mjs`, `tests/batch/engine-lane-execution.test.mjs`

### Step 3: Dashboard — separate wave from lane display

- [ ] Extend snapshot/view model:
  - `lanes[].activeTaskIds` — tasks running/pending in **current wave tick** on that lane
  - Keep `lanes[].taskIds` as batch assignment (document in UI label)
- [ ] Lane table columns: `Lane`, `Status`, `Active tasks`, `Batch assignment`, `Worktree`
- [ ] Optional: show `Wave N` in wave summary (already present); add footnote "lane ≠ wave"
- [ ] Tests: snapshot includes `activeTaskIds` when batch running

**Artifacts:** dashboard files, `tests/dashboard/snapshot-lanes.test.mjs`

### Step 4: Docs + verification

- [ ] README: one paragraph on wave (deps) vs lane (worktree isolation) vs tick
- [ ] Gap list entry for lane-packing bug → closed
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Manual: `node bin/spine.mjs plan TP-034 TP-038 TP-041` shows 3 lanes

## Completion Criteria

- [ ] Disjoint-scope multi-task plan uses ≥2 physical lanes (034/038/041 → 3)
- [ ] Engine does not parallel-spawn multiple workers on one worktree
- [ ] Dashboard distinguishes active lane tasks from cumulative assignment
- [ ] New planner + engine + dashboard tests pass; full suite green

## Must Update

- `README.md`
- `docs/compatibility/taskplane-gap-list.md`
- `taskplane-tasks/CONTEXT.md`

## Check If Affected

- `bin/spine-plan.mjs` — human formatter if lane labels change
- `tests/planner/*.test.mjs` — update expectations if any assumed old packing

## Do NOT

- Change topological wave ordering or `dependencies.json` parsing
- Remove multi-lane parallel execution across **different** worktrees
- Hand-edit batch state in tests — use fixtures and stub workers

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `fix(TP-042): assign disjoint tasks to separate virtual lanes`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
