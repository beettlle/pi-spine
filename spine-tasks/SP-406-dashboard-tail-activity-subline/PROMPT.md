# Task: SP-406 — Dashboard tail activity subline

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Optional Tier 3 UX — activity subline when lanes empty during tail.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Complete **GitHub issue #68 (Tier 3)**: when Running/Queued columns are empty but batch is not terminal, show banner or lane-agnostic activity subline from `activityPhaseLabel` / recent journal (merge started, gate opened, land loop).
**Closes:** [#68](https://github.com/beettlle/pi-spine/issues/68)

## Dependencies

- **Task:** SP-403, SP-404, SP-405

## Context to Read First

- GitHub issue #68
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- SP-364 `lane.progress_snapshot` events (if useful)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/view.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #68 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Confirm SP-403/404/405 landed; identify best subline source (macroPhase vs journal tail)

### Step 2: Activity subline in snapshot/view

- [ ] Expose `tailActivityLabel` (or reuse existing field) when zero active lane tasks
- [ ] Render subline in banner or lanes table footer in dashboard.js

### Step 3: UI contract tests

- [ ] UI contract test for tail subline present

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Review `docs/adoption/operator-runbook.md` if affected
- [ ] Close issue #68 (`gh issue close 68`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #68 closed

## Git Commit Convention

- `feat(SP-406): complete Step N — description`
- `fix(SP-406): description`
- `test(SP-406): description`

## Do NOT

- Add second reconcile path
- Block batch completion

---

## Amendments (Added During Execution)
