# Task: TP-022 — Honest batch post-mortem (Phase 4)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Operator-facing summaries must never misreport batch outcomes (NFR-OBS-03).
**Score:** 5/8

## Mission

Close **GAP-POST-01** / **NFR-OBS-03**:

1. **`generateBatchPostMortem(batchState, journalTail, reconciliation)`** — markdown summary listing: batchId, diagnosis, task outcomes (succeeded/failed/skipped counts), failed task IDs, suggested recovery commands, merge/gate/integrate status.
2. **Never claim success** when `failedTasks > 0` or diagnosis is `failed`/`needs_retry` — headline must name failures.
3. Wire into **evidence `summary.md`** (TP-021) and **`spine status --diagnose`** extended output (optional `--verbose` post-mortem section).
4. **`spine batch complete` / dismiss** — append post-mortem path to batch-history entry.
5. Tests — fixture with mixed outcomes; assert summary contains failure IDs and `/spine-retry-task` hint, not "ran smoothly".

**Out of scope:** dashboard SSE (Phase 5), supervisor mail.

**Success:** GAP-POST-01 closed in gap list; **125+** tests; wave 14.

## Dependencies

- **TP-021**

## Context to Read First

- `docs/PRD.md` — NFR-OBS-03, §18.3 operator messaging
- `docs/incidents/20260531-phase0-taskplane-batch.md`
- `src/batch/diagnosis.mjs`, `src/batch/reconcile.mjs`, `src/batch/evidence.mjs`

## File Scope

- `src/batch/postmortem.mjs` (new)
- `src/batch/evidence.mjs`, `bin/spine-status.mjs`, `src/batch/lifecycle.mjs`
- `tests/batch/postmortem.test.mjs` (new)
- `docs/compatibility/taskplane-gap-list.md`, `README.md`, `taskplane-tasks/CONTEXT.md`

## Steps

### Step 0: Preflight
- [ ] GAP-POST-01; incident report I-05 messaging

### Step 1: Post-mortem generator
### Step 2: Wire evidence + status + history
### Step 3: Tests + gap list + CONTEXT (Phase 4 done → Next TP-023)

## Completion Criteria

- [ ] Summary never claims smooth run with failures
- [ ] Tests pass (**125+**)

## Git Commit Convention

- `feat(TP-022): complete Step N — description`

## Do NOT

- Dashboard (Phase 5)

---

## Amendments (Added During Execution)
