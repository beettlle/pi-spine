# Task: SP-413 — Validate spine-tasks must-not warn

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Validate-time warning for spine-tasks/** in must-not-change.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Complete **GitHub issue #63 (optional hardening)**: `spine tasks validate` warns when `fileScopeMustNotChange` matches `spine-tasks/**` or the task's own folder. Close #63.
**Closes:** [#63](https://github.com/beettlle/pi-spine/issues/63)

## Dependencies

- **Task:** SP-410, SP-411, SP-412

## Context to Read First

- GitHub issue #63
- `src/tasks/packet/validate-contract.mjs`
- `src/tasks/packet/validate-prompt.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/validate-contract.mjs`
- `tests/tasks/validate-contract-warn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/tasks/validate-contract-warn.test.mjs` |
| fileScopeMustChange | `src/tasks/packet/validate-contract.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/tasks/validate-contract-warn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #63 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Confirm SP-410–412 docs landed

### Step 2: Validate warning

- [ ] Emit warning (not error) when must-not-change includes spine-tasks/**
- [ ] Emit warning when pattern matches current task folder
- [ ] Include fix hint in warning message

### Step 3: Warn-path unit tests

- [ ] Unit tests for warn paths in `tests/tasks/validate-contract-warn.test.mjs`

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Review `docs/adoption/operator-runbook.md` if affected
- [ ] Close issue #63 (`gh issue close 63`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #63 closed

## Git Commit Convention

- `feat(SP-413): complete Step N — description`
- `fix(SP-413): description`
- `test(SP-413): description`

## Do NOT

- Make warning a hard error without operator approval
- Change contract verify runtime behavior

---

## Amendments (Added During Execution)
