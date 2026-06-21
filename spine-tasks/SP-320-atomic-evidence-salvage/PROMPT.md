# Task: SP-320 — Atomic evidence and salvage writes

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Evidence bundles and salvage JSON are crash-sensitive during integrate and orphan recovery.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Harden evidence bundle and salvage artifact writes using atomic helpers.

Update src/batch/evidence.mjs and src/batch/salvage.mjs to write each file atomically.

For multi-file evidence bundles, write individual files atomically; optional evidence/.complete marker written last.

## Dependencies

1. **Task:** SP-318

## Context to Read First

- `src/batch/evidence.mjs`
- `src/batch/salvage.mjs`
- `src/fs/atomic-write.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/evidence.mjs`
- `src/batch/salvage.mjs`
- `tests/batch/evidence*.test.mjs`
- `tests/batch/salvage*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/` |
| fileScopeMustChange | `src/batch/evidence.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `—` |

## Steps

### Step 0: Preflight

- [ ] List all evidence and salvage write paths
- [ ] Identify existing tests to extend

### Step 1: Apply atomic writes to evidence and salvage

- [ ] Atomic write for each evidence bundle file
- [ ] Atomic write for salvage JSON
- [ ] Add .complete marker if multi-file bundle needs it

### Step 2: Testing & Verification

- [ ] Add or extend tests for evidence/salvage writes
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

- [ ] Evidence and salvage use atomic writes
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-320): complete Step N — description`
- `fix(SP-320): description`
- `test(SP-320): description`

## Do NOT

- Change evidence bundle schema

---

## Amendments (Added During Execution)
