# Task: SP-283 — Batch start superseded task guard

**Created:** 2026-06-18
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Operator safety — explicit `batch start` must not rerun `.SUPERSEDED` parent tasks that `plan pending` already excludes.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #6**: `spine batch start SP-257 SP-258 ...` launched superseded M/L parents despite `.SUPERSEDED` markers and child slices (SP-263–275) already landed. `filterPendingTaskIds` excludes superseded folders; explicit ID lists bypass that guard.

**Required behavior:**
1. `batch start` rejects any requested task ID whose folder contains `.SUPERSEDED` (fail closed with actionable error listing superseded IDs and child replacements when parseable from marker file).
2. Optional escape hatch: `--force-superseded` for deliberate reruns (document in error message).
3. Align `spine plan` / preflight messaging — operators should prefer `spine plan pending` output for start IDs.

**Closes:** [#6](https://github.com/beettlle/pi-spine/issues/6)

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `src/planner/pending.mjs` — `filterPendingTaskIds` superseded exclusion
- `src/batch/engine-scope.mjs` — `resolveBatchStartScope`
- `bin/spine-batch.mjs` — start CLI entry
- GitHub issue #6 body; batch `20260618T191236` journal

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine-scope.mjs`
- `src/planner/pending.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/batch-start-superseded-guard.test.mjs` (new)
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/engine-scope.mjs, tests/batch/batch-start-superseded-guard.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/batch-start-superseded-guard.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reproduce: explicit start with SP-257 (`.SUPERSEDED`) currently accepted
- [ ] Identify single validation hook shared by attached and detached start paths

### Step 1: Superseded guard on batch start

> **Plan-review checkpoint**

- [ ] Add `assertBatchStartTasksNotSuperseded(taskIds, tasksRoot)` (or equivalent) called from scope resolution
- [ ] Error cites superseded IDs and suggests `spine plan pending` / child task IDs from `.SUPERSEDED` file content when present
- [ ] `--force-superseded` bypass documented and tested

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] `batch-start-superseded-guard.test.mjs`: superseded ID rejected; pending ID allowed; force flag allows superseded
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Operator-runbook: never paste stale plan IDs; use `spine plan pending`
- [ ] Close GitHub issue #6: `gh issue close 6 --comment "Fixed in SP-283: batch start rejects .SUPERSEDED task IDs unless --force-superseded."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #6 closed with comment referencing SP-283
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-283): complete Step N — description`
- `fix(SP-283): description`
- `test(SP-283): description`

## Do NOT

- Remove `.SUPERSEDED` markers or child task folders
- Block `plan pending` from listing only non-superseded tasks

---

## Amendments (Added During Execution)
