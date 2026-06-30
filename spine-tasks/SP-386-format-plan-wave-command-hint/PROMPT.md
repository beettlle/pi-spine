# Task: SP-386 — Format plan wave command hint

**Created:** 2026-06-30
**Size:** S

## Review Level: 0 (None)

**Assessment:** Planner output string only; issue #54 SP-B.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Implement **GitHub issue #54** Tier 1 UX: after multi-wave plan output, suggest `spine batch start pending --wave 0` (and per-wave variants).

## Dependencies

- **Task:** SP-385 (--wave flag exists)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/format-plan.mjs`
- `tests/planner/format-plan.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/format-plan.test.mjs` |
| fileScopeMustChange | `src/planner/format-plan.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read format-plan multi-wave Then block

### Step 1: Plan hint

- [ ] Append wave-scoped start hint for multi-wave plans
- [ ] Update format-plan tests

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Update QUICK-REFERENCE if needed

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-386): complete Step N — description`
- `fix(SP-386): description`
- `test(SP-386): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
