# Task: SP-117 — Detached enginePid persistence symmetry

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** startBatchDetached persists enginePid only after wait; resume persists immediately — orphan race.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Mirror resume path: persist parent-spawned enginePid immediately on detached start. Add timeout + dead engine reconcile regression test.

**Source:** SP-106 Findings #5, #12 (MEDIUM).

## Dependencies

- **Task:** SP-111 (orphan detect foundation)

## File Scope

- `src/batch/detached-start.mjs`
- `tests/batch/detached-start-orphan-timeout.test.mjs` (new)

## Steps

### Step 1: Symmetric persistence
- [ ] persistDetachedEnginePid immediately after spawn on start path

### Step 2: Regression test
- [ ] Fixture: timeout_waiting_for_batch + dead engine → reconcile ≠ running

### Step 3: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] Start and resume persist enginePid symmetrically
- [ ] Timeout orphan test passes

## Git Commit Convention
- `fix(SP-117): detached start enginePid persistence symmetry`

## Do NOT
- Split detached-start.mjs (defer to follow-up)

---

## Amendments (Added During Execution)
