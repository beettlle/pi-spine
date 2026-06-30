# Task: SP-376 — Pause fail-loud and retry guard

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI UX + retry guard; closes #57.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #57**: if attached engine cannot pause, CLI fails clearly; `spine batch retry` allowed when batch phase is paused (not running).
**Closes:** [#57](https://github.com/beettlle/pi-spine/issues/57)

## Dependencies

- **Task:** SP-375 (engine honors pause)

## Context to Read First

- GitHub issue #57
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/pause.mjs`
- `src/batch/retry.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/pause-retry-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/pause-retry-guard.test.mjs` |
| fileScopeMustChange | `src/batch/pause.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-375 behavior
- [ ] Read retry phase guard error message

### Step 1: CLI guardrails

- [ ] Fail loud when pause journal written but phase still running after grace
- [ ] Allow batch retry when phase paused

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update runbook pause/retry guidance
- [ ] Close issue #57
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
- [ ] Issue #57 closed

## Git Commit Convention

- `feat(SP-376): complete Step N — description`
- `fix(SP-376): description`
- `test(SP-376): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
