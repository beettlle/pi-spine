# Task: SP-460 — Doctor inherit provider auth probe

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Doctor probes pi provider credentials for inherit model.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 0

## Mission

`spine doctor` must warn/fail when `agents.*.model: inherit` resolves to a provider with missing/invalid credentials (401 at worker spawn). Closes [#97](https://github.com/beettlle/pi-spine/issues/97).
**Closes:** [#97](https://github.com/beettlle/pi-spine/issues/97)

## Dependencies

- **Task:** SP-422 (canonical model validation complements this)

## Context to Read First

- GitHub issue #97
- `src/doctor/run-doctor-checks.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/doctor/run-doctor-checks.mjs`
- `src/doctor/agents-model-inherit.mjs`
- `tests/doctor/inherit-provider-auth.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/doctor/inherit-provider-auth.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/doctor/run-doctor-checks.mjs` |
| artifactsMustExist | `tests/doctor/inherit-provider-auth.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #97 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Resolve inherit provider

- [ ] Read pi default provider for inherit
- [ ] Lightweight probe or pi --list-models auth check

### Step 2: Doctor check

- [ ] Warn when non-cursor provider lacks credentials
- [ ] Actionable remediation in output

### Step 3: Tests

- [ ] Mock 401 provider → doctor fails/warns
- [ ] Valid cursor/auto → pass

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #97 (`gh issue close 97`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — doctor inherit provider check

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #97 closed

## Git Commit Convention

- `feat(SP-460): complete Step N — description`
- `fix(SP-460): description`
- `hydrate: SP-460 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
