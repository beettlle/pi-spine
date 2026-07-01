# Task: SP-384 — Status JSON lane queue parity

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI JSON parity; issue #58 SP-F / #30 extension; closes #58.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #58** Tier 4: expose `runningTaskId`, `queuedTaskIds`, `completedTaskIds` per lane in `spine status --json` / diagnose using shared snapshot helpers; close #58.
**Closes:** [#58](https://github.com/beettlle/pi-spine/issues/58)

## Dependencies

- **Task:** SP-379 (shared helpers)
- **Task:** SP-383 (dashboard behavior locked)

## Context to Read First

- GitHub issue #58
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/cli/status.mjs`
- `bin/spine-status.mjs`
- `tests/cli/status-json-lanes.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/status-json-lanes.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-384-status-json-lane-queue-parity/STATUS.md` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/cli/status-json-lanes.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #58 JSON example and SP-339 status JSON

### Step 1: CLI parity

- [ ] Reuse lane queue projection in status JSON output
- [ ] Add regression tests for lane queue fields

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #58
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
- [ ] Issue #58 closed

## Git Commit Convention

- `feat(SP-384): complete Step N — description`
- `fix(SP-384): description`
- `test(SP-384): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
