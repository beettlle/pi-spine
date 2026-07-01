# Task: SP-417 — Close #62 serialized lane verify

**Created:** 2026-07-01
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs + delivery capstone for issue #62.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close **GitHub issue #62**: update operator runbook — scoped per-task contract verify on serialized lanes; remove interim "parallel only" caveat where SP-416 landed. Close #62.
**Closes:** [#62](https://github.com/beettlle/pi-spine/issues/62)

## Dependencies

- **Task:** SP-416 (serialized lane scoped verify)
- **Task:** SP-409 (stub delivery runbook lands first — shared `operator-runbook.md`)
- **Task:** SP-412 (must-not-change runbook section lands before #62 closeout)

## Context to Read First

- GitHub issue #62
- SP-416 integration test

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `spine-tasks/SP-417-serialized-lane-verify-close-62/STATUS.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #62 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Run SP-416 integration test locally
- [ ] Verify stet-style scenario would pass

### Step 2: Runbook update

- [ ] Document per-task scoped diff for serialized lanes
- [ ] Update SP-412 interim note if present
- [ ] Link to contract-verify-serialized test

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` (informational for docs task)

### Step 4: Delivery

- [ ] Close issue #62 (`gh issue close 62`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — issue acceptance

**Check If Affected:**
- `skills/create-spine-tasks/references/contract-template.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #62 closed

## Git Commit Convention

- `feat(SP-417): complete Step N — description`
- `fix(SP-417): description`
- `test(SP-417): description`

## Do NOT

- Re-implement verify logic
- Expand scope beyond docs/delivery

---

## Amendments (Added During Execution)
