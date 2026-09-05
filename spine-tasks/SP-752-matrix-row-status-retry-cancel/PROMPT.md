# Task: SP-752 — Per-row matrix status, retry, and cancel

**Created:** 2026-09-05
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Operator CLI + retry/cancel paths for `SP-X[rowId]`; must not re-run succeeded rows; parent aggregation semantics stay unless failure policies change (#231 out of scope).
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Closes #230 — Surface per-row matrix state in `spine status` / `--diagnose` (and JSON when applicable). Accept row identity `SP-X[rowId]` for retry of one failed row and cancel of one running row vs whole matrix. Keep parent aggregation defaults. Update runbook §2.4 ops section. Depends on SP-751 env/throttle landing so row identity docs stay consistent.

## Dependencies

- **Task:** SP-751 (matrix env + throttle; shared matrix/runbook touch points)

## Context to Read First

- GitHub #230 — per-row ops brief
- `src/batch/engine-lanes/matrix-run.mjs` — `task.matrixRows`, journal events
- `bin/spine-status.mjs` / diagnosis surfaces
- `src/batch/retry.mjs` / `bin/spine-batch.mjs` — retry path
- `docs/adoption/operator-runbook.md` §2.4
- Epic #225

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `src/batch/retry.mjs`
- `bin/spine-batch.mjs`
- `bin/spine-status.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/status-json.mjs`
- `tests/batch/matrix-execution.test.mjs`
- `tests/batch/retry*.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `bin/spine-status.mjs`, `src/batch/retry.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map `task.matrixRows` status fields and journal events
- [ ] Map batch retry / cancel entry points and ID parsing

### Step 1: Status + row retry/cancel

- [ ] Show per-row running/succeeded/failed under parent in human status
- [ ] Diagnose surfaces failing row ids clearly
- [ ] `spine batch retry SP-X[rowId]` retries one failed row without re-executing succeeded rows
- [ ] Cancel single row vs whole matrix — document and implement with tests
- [ ] JSON status includes row array when present

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Add/extend tests for status rows + retry identity parsing

### Step 3: Documentation & Delivery

- [ ] Update runbook §2.4 ops (status / retry / cancel)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — §2.4 per-row status, retry, cancel

**Check If Affected:**

- `docs/QUICK-REFERENCE.md` — batch retry examples if listed

## Completion Criteria

- [ ] `spine status` shows per-row running/succeeded/failed
- [ ] Diagnose surfaces failing row ids
- [ ] Retry single `SP-X[rowId]` without re-executing succeeded rows
- [ ] Cancel single row vs whole matrix documented and tested
- [ ] Runbook §2.4 ops updated
- [ ] Closes #230
- [ ] `.DONE` created

## Do NOT

- Implement `maxFailedIndexes` / success policies (#231)
- Re-introduce nested parent+inner double-counting of lanes
- Change SP-751 env var names
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-752): matrix per-row status retry cancel (#230)`
