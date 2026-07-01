# Task: SP-391 — Sequence journal events

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Observability for sequence runner.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #54** observability: journal events `sequence.wave_started`, `sequence.wave_completed`, `sequence.halted` with wave index and batchId payload.

## Dependencies

- **Task:** SP-387
- **Task:** SP-389 (sequence state landed first)
- **Task:** SP-390 (auto-approve safety landed first)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `tests/batch/sequence-journal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-journal.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-391-sequence-journal-events/STATUS.md` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Review journal event naming conventions

### Step 1: Journal events

- [ ] Emit sequence lifecycle events
- [ ] Test journal tail contains expected types

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

- `feat(SP-391): complete Step N — description`
- `fix(SP-391): description`
- `test(SP-391): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
