# Task: SP-372 — Reviewer model observability and docs

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Journal/metrics fields + operator docs; closes #53.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Finish **GitHub issue #53**: include resolved model/thinking in review journal events and run-metrics when pinned; document per-type cascade in operator runbook; close issue.
**Closes:** [#53](https://github.com/beettlle/pi-spine/issues/53)

## Dependencies

- **Task:** SP-371 (settings/doctor landed)

## Context to Read First

- GitHub issue #53
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-spawn.mjs`
- `src/batch/metrics.mjs`
- `docs/adoption/operator-runbook.md`
- `tests/batch/review-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/review-spawn.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-372-reviewer-model-observability-docs/STATUS.md` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #53 observability acceptance criteria

### Step 1: Observability and docs

- [ ] Add resolved model/thinking to review.started payload when set
- [ ] Extend metrics reviewer records if applicable
- [ ] Document per-type pins and cascade in operator runbook § Agent model pins

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Close issue #53 (`gh issue close 53`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `docs/PRD.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #53 closed

## Git Commit Convention

- `feat(SP-372): complete Step N — description`
- `fix(SP-372): description`
- `test(SP-372): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
