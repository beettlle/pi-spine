# Task: SP-389 — Sequence state persistence and resume

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Runtime state artifact; issue #54 SP-D.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Implement **GitHub issue #54** Tier 2 persistence: store sequence progress under `.spine/runtime/`; `spine run sequence pending --resume` continues from last completed wave.

## Dependencies

- **Task:** SP-388 (CLI entrypoint)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence-state.mjs`
- `src/batch/sequence.mjs`
- `tests/batch/sequence-resume.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-resume.test.mjs` |
| fileScopeMustChange | `src/batch/sequence-state.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/sequence-resume.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 SP-D open questions on state artifact

### Step 1: State + resume

- [ ] Persist fromWave, completedWaves, lastBatchId
- [ ] Resume after interrupted wave 0 integrate
- [ ] Test halt on failure with --stop-on-failure

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

- `feat(SP-389): complete Step N — description`
- `fix(SP-389): description`
- `test(SP-389): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
