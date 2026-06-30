# Task: SP-387 — Sequence runner core loop

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New batch orchestration module; issue #54 SP-C core.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #54** Tier 2 core: `src/batch/sequence.mjs` with wait-for-terminal batch loop using reconcileBatch/diagnose; support `--dry-run` command list per wave.

## Dependencies

- **Task:** SP-385 (wave-scoped starts)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `tests/batch/sequence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence.test.mjs` |
| fileScopeMustChange | `src/batch/sequence.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/sequence.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 sequence loop pseudocode
- [ ] Audit lifecycle/gate/integrate/complete CLIs

### Step 1: Sequence core

- [ ] Implement per-wave: start → wait terminal → land loop steps
- [ ] Dry-run prints operator-equivalent commands
- [ ] Stub-worker fixture for 2-wave happy path

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery



## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-387): complete Step N — description`
- `fix(SP-387): description`
- `test(SP-387): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
