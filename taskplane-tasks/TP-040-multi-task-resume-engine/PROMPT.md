# Task: TP-040 — Multi-task resume engine + detached

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-040-multi-task-resume-engine/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement **`resumeBatch` multi-task execution** so paused/failed batches with multiple tasks/lanes can resume (including default detached start).

Deliverables:
1. **`resumeMultiTaskBatch`** in `resume-multi.mjs`:
   - Reconcile pending tasks/waves from validation result
   - Restart or spawn workers for pending segments across lanes (reuse multi-lane engine patterns from TP-019)
   - Update batch phase → `running`; journal `batch.resumed`
2. **`resumeBatch`** routes to multi path when `tasks.length > 1 || lanes.length > 1`
3. **`bin/spine-batch.mjs resume`** — detached default already exists; ensure multi-task resume writes detached log and does not require `--attached`
4. **Tests** — stub worker mode: 2-task fixture resumes without `single_lane_required` error; journal contains `batch.resumed`

**Success:** `spine batch resume` works on 2-task paused fixture in tests; CLI error message no longer cites TP-015 limit.

## Dependencies

- **TP-039** — multi-task validation

## Context to Read First

**Tier 3:**
- `src/batch/resume.mjs`, `src/batch/resume-multi.mjs`
- `src/batch/engine.mjs` or multi-lane start patterns
- `src/batch/detached-start.mjs`, `bin/spine-batch.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/batch/resume-multi.mjs` (extend)
- `src/batch/resume.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/resume-multi-engine.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Trace single-lane `resumeBatch` flow; read multi-lane engine entry points
- [ ] Baseline tests

### Step 1: Resume engine

> **Plan-review checkpoint**

- [ ] Implement multi-task resume loop (pending tasks by wave, lane assignment)
- [ ] Journal + batch-state updates; fail loud on partial spawn failure

**Artifacts:** `src/batch/resume-multi.mjs`, `src/batch/resume.mjs`

### Step 2: CLI + detached

- [ ] Ensure `spine batch resume` uses multi path + detached wrapper
- [ ] Engine tests with `SPINE_WORKER_STUB=1`

### Step 3: Verification

> **Code review checkpoint**

- [ ] Full suite green

## Completion Criteria

- [ ] Multi-task resume executes in stub mode tests
- [ ] Detached resume path invoked
- [ ] No `single_lane_required` for valid multi batches

## Must Update

- `README.md` — document multi-task resume

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not change integrate/merge behavior
- Do not remove single-task resume code paths

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
