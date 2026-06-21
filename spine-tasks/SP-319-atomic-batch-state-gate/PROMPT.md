# Task: SP-319 — Atomic batch-state and gate writes

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Orchestration truth files batch-state.json and gate.json need crash-safe writes; touches core batch persistence.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Harden batch-state and gate record persistence using shared atomic writes from SP-318.

Update saveSpineBatchState in src/batch/state.mjs and saveGateRecord in src/batch/gate.mjs to use writeJsonAtomic.

Keep append-only journal and run-metrics unchanged.

Extend state-transition tests to assert no partial JSON on interrupted writes.

## Dependencies

1. **Task:** SP-318

## Context to Read First

- `src/batch/state.mjs`
- `src/batch/gate.mjs`
- `src/fs/atomic-write.mjs`
- `tests/batch/state-transition.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/state.mjs`
- `src/batch/gate.mjs`
- `tests/batch/state-transition.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/state-transition.test.mjs` |
| fileScopeMustChange | `src/batch/state.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `—` |

## Steps

### Step 0: Preflight

- [ ] Identify all saveSpineBatchState and saveGateRecord call sites
- [ ] Confirm SP-318 atomic util is available

### Step 1: Apply atomic writes to batch-state and gate

- [ ] Use writeJsonAtomic for batch-state.json writes
- [ ] Use writeJsonAtomic for gate.json writes
- [ ] Preserve recordTaskTransition ordering semantics

### Step 2: Testing & Verification

- [ ] Extend state-transition tests for atomic write behavior
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Add atomic writes note to docs/adoption/operator-runbook.md
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] batch-state and gate use atomic writes
- [ ] Journal/metrics unchanged
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-319): complete Step N — description`
- `fix(SP-319): description`
- `test(SP-319): description`

## Do NOT

- Change batch-state schema
- Convert journal to overwrite writes

---

## Amendments (Added During Execution)
