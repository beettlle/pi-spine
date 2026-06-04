# Task: SP-096 — Per-lane sequential multi-task resume

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `resumeMultiTaskBatch` uses `Promise.all(waveRuns)` for every pending task in a wave, violating PRD §9.4 — searchATon lane-1 had four simultaneous `running` tasks on one worktree.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Align **multi-task resume** with the batch start engine: tasks on the same `laneNumber` run **sequentially**; only different lanes run in parallel. Mirror `engine.mjs` (group by lane, sequential within, `Promise.all` across lanes). Emit `lane.tasks_serialized` when a lane queue has more than one task.

**Bug report:** `/Users/cdelgado/Documents/github.com/searchATon/spine-bug-report-batch-20260603T224829.md` (Bug 2).

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `src/batch/resume-multi.mjs` (~535–606)
- `src/batch/engine.mjs` (~246–267)
- `docs/PRD.md` §9.4

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi.mjs`
- `tests/batch/resume-multi-sequential.test.mjs` (new)
- `tests/batch/resume-multi.test.mjs` (extend if present)

## Steps

### Step 0: Preflight

- [ ] Confirm flat `waveRuns` + `Promise.all` in `resume-multi.mjs`
- [ ] Identify `engine.mjs` lane serialization reference

### Step 1: Lane-grouped wave execution

> **Plan-review checkpoint**

- [ ] `Map<laneNumber, runs[]>`; sequential await within lane; `Promise.all` across lanes
- [ ] Preserve `batchAborted` short-circuit
- [ ] Call `spine_review_step` (plan)

### Step 2: Journal + batch-state invariants

> **Code review checkpoint**

- [ ] `lane.tasks_serialized` when queue length > 1
- [ ] ≤1 `running` task per `laneNumber` during resume wave
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] 4 lane-1 tasks → serialized starts (no overlap)
- [ ] 2 lanes × 2 tasks → cross-lane parallelism preserved
- [ ] FULL suite + `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] `docs/adoption/operator-runbook.md` — resume lane serialization
- [ ] STATUS.md discoveries

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `docs/PRD.md` §9.4

## Completion Criteria

- [ ] Single-lane multi-task resume is sequential
- [ ] Multi-lane resume still parallel across lanes

## Git Commit Convention

- `feat(SP-096): complete Step N — description`

## Do NOT

- Change orphan detection (SP-095)
- Implement engine crash surfacing (SP-097)

---

## Amendments (Added During Execution)
