# Task: TP-039 — Multi-task resume validation

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-039-multi-task-resume-validation/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Remove the **single-task/single-lane resume gate** (TP-015 limitation) at the validation layer and define multi-task resume preconditions.

Deliverables:
1. **`src/batch/resume-multi.mjs`** — `validateMultiTaskResume({ projectRoot, force })`:
   - Accept batches with **≥1 task** and **≥1 lane** when phase is `paused` or `failed+force`
   - Preserve existing checks: no active batch, segment drift, invalid state, worktree existence **per lane**
   - Return `{ ok, batchId, pendingTasks[], lanes[], resumableWave? }`
2. **Refactor** `validateResumeBatch` in `resume.mjs` to delegate to multi validator (single-task becomes subset)
3. **Tests** — fixture 2-task batch state (like `20260602T181027` shape) passes validation; 0-task fails; missing worktree fails per lane

**Out of scope:** actually restarting workers (TP-040).

**Success:** `validateMultiTaskResume` tests pass; old single-task tests still pass via delegation.

## Dependencies

- **TP-030** — batch state + journal stable

## Context to Read First

**Tier 3:**
- `src/batch/resume.mjs` — current `single_lane_required` at lines ~161-169
- `tests/batch/resume.test.mjs` — existing fixtures
- `src/batch/reconcile.mjs` — pending task detection

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/batch/resume-multi.mjs` (new)
- `src/batch/resume.mjs` — delegate validation
- `tests/batch/resume-multi-validation.test.mjs` (new)
- `tests/batch/resume.test.mjs` (update expectations)

## Steps

### Step 0: Preflight

- [ ] Read TP-015 PROMPT + incident notes on batch `20260602T181027`; baseline tests

### Step 1: Multi-task validator

> **Plan-review checkpoint**

- [ ] Implement `validateMultiTaskResume` with lane worktree checks for all lanes
- [ ] Compute `pendingTasks` from batch state + segment statuses
- [ ] Wire delegation from `validateResumeBatch`; remove hard `single_lane_required` for valid multi batches

**Artifacts:** `src/batch/resume-multi.mjs`, updated `resume.mjs`

### Step 2: Tests

> **Code review checkpoint**

- [ ] New fixtures: 2 tasks / 2 lanes paused batch; single-task regression
- [ ] Full suite green

## Completion Criteria

- [ ] Multi-task paused batch validates OK
- [ ] Single-task behavior preserved
- [ ] Tests pass

## Must Update

- `taskplane-tasks/CONTEXT.md` when Done

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not start workers or modify engine loop (TP-040)
- Do not hand-edit batch state in tests — use fixtures

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
