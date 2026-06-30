# Task: SP-380 — Dashboard Running and Queued columns

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Dashboard UI only; issue #58 SP-B.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #58** UI: replace flat Active tasks column with **Running** and **Queued (N)** columns (Option A); a11y labels per issue.

## Dependencies

- **Task:** SP-379 (snapshot fields)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/view.mjs`
- `src/dashboard/public/index.html`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/dashboard.css`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/public/dashboard.js` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #58 UX/a11y notes

### Step 1: UI columns

- [ ] Update view model for runningTaskId and queuedTaskIds
- [ ] Render Running and Queued columns with ▶/○ prefixes and aria-labels
- [ ] Responsive fallback for narrow widths if needed

### Step 2: Testing & Verification

- [ ] Run ui-contract tests
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update STATUS with screenshot notes if helpful

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

- `feat(SP-380): complete Step N — description`
- `fix(SP-380): description`
- `test(SP-380): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
