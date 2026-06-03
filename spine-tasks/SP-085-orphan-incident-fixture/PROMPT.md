# Task: SP-085 — Orphan running incident fixture (SAT pattern)

**Created:** 2026-06-03
**Size:** S

## Review Level: 1 (Plan Only)

**Score:** 2/8

## Mission

Add regression fixture + test for searchATon-style **orphan running** incident (batch `20260603T185308` pattern): `task.started` → `lane.heartbeat` → silence with dead workerPid. Complements SP-082 acceptance tests with documented incident narrative.

## Dependencies

- **Task:** SP-082

## File Scope

- `tests/fixtures/incidents/orphan-running-resume.json` (new)
- `tests/batch/orphan-reconcile.test.mjs`
- `docs/incidents/20260603-orphan-running-resume.md` (new — incident record)

## Steps

### Step 1: Fixture

- [ ] JSON fixture: batch-state + journal tail matching bug report
- [ ] Test asserts reconcile diagnosis ≠ `running`

### Step 2: Incident doc

- [ ] Document searchATon context, reproduction sketch, acceptance criteria checklist

### Step 3: Verification

- [ ] FULL suite passes

## Git Commit Convention

- `test(SP-085): orphan running incident fixture`

## Do NOT

- Duplicate SP-082 implementation (fixture/tests only)

---

## Amendments (Added During Execution)
