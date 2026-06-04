# Task: SP-097 — Resume engine crash failure surfacing

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Engine crashed in `commitLaneWorktree` during `resume --force` left `phase: running`, orphaned workers, and ghost `running` tasks (e.g. SAT-040 with no worker) — no `batch.failed` or terminal phase transition.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2

## Mission

When the **detached resume engine** throws (e.g. git worktree error in `lane-commit.mjs`), the batch must **fail closed**:

1. Append journal `batch.failed` (or `lane.died` + batch terminal) with error context
2. Transition batch-state `phase` to `failed` (or `paused` with explicit `lastError`) — not leave `running`
3. Clear or mark stale `running` tasks that never got a worker (ghost tasks)
4. Clear `resilience.enginePid` on engine exit (normal and crash paths)

Reconcile after crash must surface actionable diagnosis (works with SP-095 scoped orphan detect).

**Bug report:** `/Users/cdelgado/Documents/github.com/searchATon/spine-bug-report-batch-20260603T224829.md` (Bugs 3–4).

## Dependencies

- **Task:** SP-096 (per-lane resume structure — land first to avoid merge conflicts in `resume-multi.mjs`)

## Context to Read First

**Tier 3:**
- `src/batch/resume-multi.mjs` — top-level try/catch, wave completion
- `src/batch/lane-commit.mjs` — `commitLaneWorktree` throw site
- `src/batch/state.mjs` — phase transitions, `clearBatchEnginePid`
- `src/batch/lifecycle.mjs` — `transitionPhase`
- `src/batch/detached-start.mjs` — detached engine wrapper
- `docs/incidents/20260531-phase0-taskplane-batch.md` — prior engine crash patterns

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi.mjs`
- `src/batch/lane-commit.mjs`
- `src/batch/state.mjs`
- `src/batch/detached-start.mjs` (if crash handler lives here)
- `tests/batch/resume-engine-crash.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read detached-engine.log pattern from bug report (`git status` worktree failure)
- [ ] Trace uncaught rejection path from `Promise.all` / lane commit to process exit

### Step 1: Crash handler + journal terminal event

> **Plan-review checkpoint**

- [ ] Wrap resume engine entry / wave loop so unhandled errors call shared `failBatchFromEngineError({ projectRoot, state, batchId, error })`
- [ ] Append `batch.failed` with `reason`, `taskId`, `laneNumber` when known
- [ ] Call `spine_review_step` (plan)

### Step 2: Phase transition + ghost task cleanup

> **Code review checkpoint**

- [ ] Set `phase: failed`, `endedAt`, `lastError`; clear `enginePid`
- [ ] Mark `running` tasks without active worker as `failed` or `pending` per existing retry semantics (document choice in STATUS)
- [ ] Ensure workers orphaned by engine death are not left with misleading batch-state `running` phase
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] Stub `commitLaneWorktree` throw → batch-state not `running`, journal has terminal event
- [ ] Reconcile on fixture → diagnosis ≠ `running`
- [ ] FULL suite + `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] Operator runbook: engine crash during resume → `spine status --diagnose`, retry/abort
- [ ] STATUS.md discoveries

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — resume engine crash recovery

**Check If Affected:**
- `docs/incidents/20260603-orphan-running-resume.md`

## Completion Criteria

- [ ] Simulated engine crash leaves terminal journal + non-`running` phase
- [ ] No ghost `running` task without worker after engine exit

## Git Commit Convention

- `feat(SP-097): complete Step N — description`

## Do NOT

- Re-implement per-lane serialization (SP-096)
- Kill orphaned container workers from spine (consumer responsibility) — only fix batch-state/journal

---

## Amendments (Added During Execution)
