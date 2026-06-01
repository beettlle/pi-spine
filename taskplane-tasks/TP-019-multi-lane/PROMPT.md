# Task: TP-019 — Multi-lane engine + mixed-outcome merge (Phase 3)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Extends engine beyond single-task batches; enforces §17.4 mixed-outcome policy (GAP-MERGE-01).
**Score:** 6/8

## Mission

1. **Multi-lane scheduler** — respect `lanes.maxParallel`; planner lane assignment per wave (FR-SCHED-03/04).
2. **Parallel worktrees** — one per lane; sequential merge to orch v1 (FR-BATCH-08).
3. **Mixed-outcome policy** — block wave merge when any task failed/pending unless `/spine-skip-task` or force-merge path (FR-BATCH-10, §17.4).
4. **`spine batch start`** — allow scoped multi-task batches (relax single-task-only guard when plan has one wave and lanes > 1 OR explicit scope).

**Out of scope:** polyrepo segments; merger agent; Phase 4 gates.

## Dependencies

- **TP-018**
- **TP-017**
- **TP-015**

## File Scope

- `src/batch/engine.mjs`, `src/batch/worktree.mjs`, `src/planner/`, `bin/spine-batch.mjs`
- `tests/batch/engine.test.mjs`, `tests/planner/`, `README.md`

## Steps

### Step 0: Preflight
- [ ] §17.4; GAP-MERGE-01; retry/skip on `main`

### Step 1: Multi-lane provision + wave loop
- [ ] Provision N lanes; assign tasks from plan ticks

### Step 2: Mixed-outcome merge guard
- [ ] Refuse merge with failed/pending; operator messaging

### Step 3: Tests + docs
- [ ] Multi-lane fixture; README; CONTEXT

## Completion Criteria

- [ ] Two-lane smoke batch in tests; merge blocked on mixed outcomes

## Git Commit Convention

- `feat(TP-019): complete Step N — description`

## Do NOT

- Phase 4 gates; polyrepo

---

## Amendments (Added During Execution)
