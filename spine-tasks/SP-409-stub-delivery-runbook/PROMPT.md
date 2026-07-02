# Task: SP-409 — Stub delivery runbook and close #67

**Created:** 2026-07-01
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only delivery for stub batch operator workflow.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document **GitHub issue #67** resolution: stub batches with delivery-only `fileScopeMustChange` auto-complete STATUS.md (SP-408). Update operator runbook stub section; close #67.
**Closes:** [#67](https://github.com/beettlle/pi-spine/issues/67)

## Dependencies

- **Task:** SP-408 (stub runner STATUS delivery)

## Context to Read First

- GitHub issue #67
- `docs/adoption/operator-runbook.md` § stub batches

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `spine-tasks/SP-409-stub-delivery-runbook/STATUS.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #67 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Verify SP-408 behavior in stub-runner tests

### Step 2: Runbook stub delivery section

- [ ] Document auto STATUS delivery for delivery-only contracts
- [ ] Document when manual lane delivery still required (implementation scopes)
- [ ] Link to SP-349 and SP-373 pre-landed behavior

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Delivery

- [ ] Close issue #67 (`gh issue close 67`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — issue acceptance

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #67 closed

## Git Commit Convention

- `feat(SP-409): complete Step N — description`
- `fix(SP-409): description`
- `test(SP-409): description`

## Do NOT

- Change stub runner code
- Claim manual delivery never needed for implementation tasks

---

## Amendments (Added During Execution)
