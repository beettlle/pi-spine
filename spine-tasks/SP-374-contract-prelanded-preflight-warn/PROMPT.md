# Task: SP-374 — Preflight warn stale fileScopeMustChange

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Preflight/validate warning only; closes #56.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #56**: `spine tasks validate` and/or preflight warn when PROMPT `fileScopeMustChange` paths have no diff vs `main` before batch start.
**Closes:** [#56](https://github.com/beettlle/pi-spine/issues/56)

## Dependencies

- **Task:** SP-373 (verifier semantics aligned)

## Context to Read First

- GitHub issue #56
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/validate-prompt.mjs`
- `src/config/spine-preflight-lib.mjs`
- `tests/tasks/validate-prelanded-contract.test.mjs`
- `tests/config/spine-preflight-prelanded.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/tasks/validate-prelanded-contract.test.mjs tests/config/spine-preflight-prelanded.test.mjs` |
| fileScopeMustChange | `src/config/spine-preflight-lib.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #56 suggested validate/preflight fix

### Step 1: Validate and preflight warnings

- [ ] Add warning (not hard fail) for stale fileScopeMustChange vs main
- [ ] Suggest PROMPT amendment workflow in message

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Document warning in operator runbook § Contract
- [ ] Close issue #56
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #56 closed

## Git Commit Convention

- `feat(SP-374): complete Step N — description`
- `fix(SP-374): description`
- `test(SP-374): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
