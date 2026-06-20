# Task: SP-326 — Per-lane stats derivation module

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New pure module deriving per-lane throughput from batch-state, journal, and run-metrics — task-based not token-based.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Create per-lane throughput stats derivation module.

New src/dashboard/lane-throughput.mjs derives from batch-state lanes + journal + run-metrics when present.

Per lane: activeElapsedMs, completedCount, failedCount, throughputTasksPerHour.

## Dependencies

1. **Task:** SP-325

## Context to Read First

- `src/dashboard/snapshot.mjs`
- `src/batch/metrics.mjs`
- `tests/batch/integration-abc.test.mjs`
- `tests/fixtures/batch-state/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/dashboard/lane-throughput.mjs`
- `tests/dashboard/lane-throughput.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/lane-throughput.test.mjs` |
| fileScopeMustChange | `src/dashboard/lane-throughput.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/dashboard/lane-throughput.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Review journal event types for task lifecycle
- [ ] Identify batch-state lane shape

### Step 1: Implement lane-throughput derivation

- [ ] Create src/dashboard/lane-throughput.mjs
- [ ] Derive per-lane stats from journal + batch-state
- [ ] Fall back gracefully when metrics missing

### Step 2: Testing & Verification

- [ ] Add tests/dashboard/lane-throughput.test.mjs
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- None

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Lane throughput module exists with tests
- [ ] Stats are task-based not token-based

## Git Commit Convention

- `feat(SP-326): complete Step N — description`
- `fix(SP-326): description`
- `test(SP-326): description`

## Do NOT

- Add LLM token metrics
- Require run-metrics for basic stats

---

## Amendments (Added During Execution)
