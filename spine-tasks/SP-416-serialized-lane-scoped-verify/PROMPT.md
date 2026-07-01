# Task: SP-416 — Serialized lane scoped verify

**Created:** 2026-07-01
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Wire scoped diff into verifyContract and engine final review.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #62**: pass `taskStartCommit` from SP-415 into `verifyContract` / `listChangedFiles` (SP-414) so `fileScopeMustChange` and `fileScopeMustNotChange` scope to **this task only** on serialized lanes.

## Dependencies

- **Task:** SP-414 (scoped diff API), SP-415 (resolve task start commit)

## Context to Read First

- GitHub issue #62
- `src/batch/contract-verify.mjs`
- engine final review / lane commit verify hook

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/contract-verify-serialized.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-verify-serialized.test.mjs tests/batch/contract-verify-scoped.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/contract-verify-serialized.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #62 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Confirm SP-414 and SP-415 modules exported

### Step 2: verifyContract scoped wiring

- [ ] Accept optional `sinceCommit` in verifyContract options
- [ ] Apply scoped diff to must-change and must-not-change checks
- [ ] Fallback to main...HEAD when sinceCommit null

### Step 3: Engine hook

- [ ] At final contract verify, resolve taskStartCommit via SP-415 and pass to verifyContract

### Step 4: Integration test

- [ ] Two tasks on one lane branch: task 2 must not fail must-not-change for paths only task 1 committed
- [ ] Parallel lane behavior unchanged

### Step 5: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] Review `docs/adoption/operator-runbook.md` if affected

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-416): complete Step N — description`
- `fix(SP-416): description`
- `test(SP-416): description`

## Do NOT

- Change planner serialization rules
- Break single-task lane verify

---

## Amendments (Added During Execution)
