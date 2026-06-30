# Task: SP-392 — Sequence diagnose and dashboard surfaces

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator surfaces; closes #54 Tier 2 (Tier 3 deferred to SP-393).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #54** Tier 2 SP-F: `spine status --diagnose` shows active sequence, current wave, suggested resume command; optional dashboard batch summary line; document sequence vs autoIntegrateBetweenWaves; close #54.
**Closes:** [#54](https://github.com/beettlle/pi-spine/issues/54)

## Dependencies

- **Task:** SP-389 (state)
- **Task:** SP-383 (dashboard docs/tests locked)
- **Task:** SP-384 (status JSON lane queue parity landed first)
- **Task:** SP-391 (journal events)

## Context to Read First

- GitHub issue #54
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnose.mjs`
- `src/dashboard/snapshot.mjs`
- `docs/adoption/operator-runbook.md`
- `docs/EXECUTION-FLOW.md`
- `tests/batch/sequence-diagnose.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-diagnose.test.mjs` |
| fileScopeMustChange | `src/batch/diagnose.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 SP-F and config comparison table

### Step 1: Diagnose and docs

- [ ] Surface sequence state in diagnose output and suggestedCommand
- [ ] Document sequence runner in runbook §4 and EXECUTION-FLOW
- [ ] Note Tier 3 supervisor deferred to SP-393 explore

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #54
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `docs/EXECUTION-FLOW.md`
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #54 closed

## Git Commit Convention

- `feat(SP-392): complete Step N — description`
- `fix(SP-392): description`
- `test(SP-392): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
