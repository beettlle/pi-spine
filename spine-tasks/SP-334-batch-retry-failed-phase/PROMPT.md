# Task: SP-334 — Batch retry failed-phase recovery

**Created:** 2026-06-28
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `batch retry` leaves batch in `failed` phase with pending tasks; preflight and `resume --force` both blocked.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #25**: after worker failure, `spine batch retry <taskId>` resets task to `pending` but batch stays `phase: failed` with `failedTasks: 0`. Preflight fails `no-active-batch`; `resume --force` refuses `phase=failed`.

**Required behavior:**

1. After `batch retry` when only pending tasks remain, transition batch to `running` (or `needs_retry`) so resume works.
2. `resume --force` succeeds from `failed` when `hasPendingTasks` and no `failedTasks`.
3. Diagnosis `suggestedCommand` matches working recovery path.
4. Regression test from Optimator batch `20260622T220028` journal pattern.

**Closes:** [#25](https://github.com/beettlle/pi-spine/issues/25)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #25
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/retry.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/batch-retry-failed-phase.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/batch-retry-failed-phase.test.mjs` |
| fileScopeMustChange | `src/batch/retry.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/batch-retry-failed-phase.test.mjs` |

## Steps

### Step 0: Preflight: reconstruct #25 journal

- [ ] Preflight: reconstruct #25 journal

### Step 1: Retry transitions batch to resumable phase

- [ ] Retry transitions batch to resumable phase

### Step 2: Diagnosis + runbook

- [ ] Diagnosis + runbook

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #25 (`gh issue close 25`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #25 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-334): complete Step N — description`
- `fix(SP-334): description`
- `test(SP-334): description`

## Do NOT

- Expand scope beyond issue #25 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
