# Task: SP-408 — Stub runner STATUS.md delivery

**Created:** 2026-07-01
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Stub worker auto-writes delivery block before .DONE.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #67 (Option A)**: in `bin/spine-worker-runner.mjs` stub path, when contract `fileScopeMustChange` is delivery-only (SP-407), append minimal delivery block to `STATUS.md` (Current Step: Complete, Status: Complete) before writing `.DONE`.

## Dependencies

- **Task:** SP-407 (delivery-only scope detector)

## Context to Read First

- GitHub issue #67
- `bin/spine-worker-runner.mjs`
- SP-407 `isStubDeliveryOnlyScope`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-worker-runner.mjs`
- `tests/batch/stub-runner-delivery.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/stub-runner-delivery.test.mjs tests/batch/contract-stub-delivery.test.mjs` |
| fileScopeMustChange | `bin/spine-worker-runner.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/stub-runner-delivery.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #67 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Import SP-407 helper
- [ ] Identify stub completion path before lane commit

### Step 2: Auto-write STATUS.md

- [ ] When stub mode + delivery-only scope, write/append STATUS delivery block
- [ ] Preserve existing STATUS content where possible
- [ ] Then write `.DONE` as today

### Step 3: Integration tests

- [ ] Stub run with amended PROMPT (STATUS-only scope) passes `verifyStubFileScopeMustChange`
- [ ] Implementation scope still requires real changes

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-408): complete Step N — description`
- `fix(SP-408): description`
- `test(SP-408): description`

## Do NOT

- Auto-touch implementation fileScopeMustChange paths
- Disable SP-349 enforcement

---

## Amendments (Added During Execution)
