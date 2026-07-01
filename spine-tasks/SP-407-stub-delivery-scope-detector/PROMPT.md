# Task: SP-407 — Stub delivery-only scope detector

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure helper detecting delivery-only fileScopeMustChange patterns.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Support **GitHub issue #67 (Option A)**: add helper `isStubDeliveryOnlyScope(patterns)` — true when `fileScopeMustChange` targets only `spine-tasks/*/STATUS.md`, `.DONE`, or task-folder delivery artifacts.

## Dependencies

- **None**

## Context to Read First

- GitHub issue #67
- `src/batch/contract-prelanded.mjs`
- `bin/spine-worker-runner.mjs` stub path

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-stub-delivery.mjs`
- `tests/batch/contract-stub-delivery.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-stub-delivery.test.mjs` |
| fileScopeMustChange | `src/batch/contract-stub-delivery.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/contract-stub-delivery.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #67 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Read issue #67 reproduction (batch 20260701T031142)
- [ ] List delivery artifact patterns from SP-349 stub verify

### Step 2: Detector module

- [ ] Create `contract-stub-delivery.mjs` with `isStubDeliveryOnlyScope` and `isDeliveryArtifactPath`
- [ ] Reject patterns that include implementation paths (src/**, etc.)

### Step 3: Unit tests

- [ ] Positive: STATUS.md-only, .DONE-only, spine-tasks/<id>/** delivery
- [ ] Negative: mixed implementation + STATUS patterns

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

- `feat(SP-407): complete Step N — description`
- `fix(SP-407): description`
- `test(SP-407): description`

## Do NOT

- Modify stub runner yet (SP-408)
- Bypass SP-349 for implementation scopes

---

## Amendments (Added During Execution)
