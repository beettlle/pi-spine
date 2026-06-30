# Task: SP-378 — Attached merge finalize before engine exit

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Engine land-loop reliability; closes #59.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #59**: after last wave merge on attached batches, engine must finalize land loop in-process or spawn detached resume **before** exit so integrate gate opens without operator `resume --force`.
**Closes:** [#59](https://github.com/beettlle/pi-spine/issues/59)

## Dependencies

- **Task:** SP-377 (regression fixture)
- **Task:** SP-348 (prior limbo fix)

## Context to Read First

- GitHub issue #59
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/post-merge-limbo-20260630.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/post-merge-limbo-20260630.test.mjs tests/batch/post-merge-limbo-regression.test.mjs` |
| fileScopeMustChange | `src/batch/post-merge-limbo.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Run SP-377 fixture (expect fail before fix)
- [ ] Read SP-316/SP-358 land loop paths

### Step 1: Finalize before exit

- [ ] Ensure attached engine opens gate or spawns detached resume before SIGTERM exit path
- [ ] Make SP-377 fixture pass; keep SP-348 regression green

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #59
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`
- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #59 closed

## Git Commit Convention

- `feat(SP-378): complete Step N — description`
- `fix(SP-378): description`
- `test(SP-378): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
