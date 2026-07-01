# Task: SP-377 — Post-merge limbo regression fixture

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Test fixture from production incident; no engine change yet.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Address **GitHub issue #59** (partial): add regression fixture reproducing batch `20260630T212050` — merge completes then engine SIGTERM before gate opens.

## Dependencies

- **Task:** SP-358 (detached start land loop baseline)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/batch/post-merge-limbo-20260630.test.mjs`
- `tests/fixtures/batch-20260630T212050/**`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/post-merge-limbo-20260630.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-377-post-merge-limbo-regression-fixture/STATUS.md` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/post-merge-limbo-20260630.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #59 journal timeline
- [ ] Compare with SP-348 regression tests

### Step 1: Fixture

- [ ] Materialize journal/batch-state fixture for 20260630T212050 orphan-after-merge
- [ ] Test asserts postMergeLimbo + no gate until resume --force (may start red)

### Step 2: Testing & Verification

- [ ] Run targeted tests
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Link fixture path in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-377): complete Step N — description`
- `fix(SP-377): description`
- `test(SP-377): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)

- **2026-06-30:** Fixture test pre-landed on `main` (`tests/batch/post-merge-limbo-20260630.test.mjs`). `fileScopeMustChange` targets delivery `STATUS.md`; `testCommand` + `artifactsMustExist` verify regression fixture.
