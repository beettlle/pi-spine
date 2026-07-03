# Task: SP-447 — Dashboard truth for engine_orphaned and drift

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Dashboard operator UX; closes #100 when combined with SP-445/446.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Dashboard batch summary must derive from `phase` + `diagnosis` + `endedAt`, not `allTasksTerminalSuccess` or lane `terminal-success` alone. When `diagnosis === engine_orphaned` or `state_drift`, summary must not read "completed"; show recovery CTA (`resume --force`). Closes [#100](https://github.com/beettlle/pi-spine/issues/100).

## Dependencies

- **Task:** SP-446 (diagnosis signals for drift/orphan)

## Context to Read First

- GitHub issue [#100](https://github.com/beettlle/pi-spine/issues/100)
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `tests/dashboard/*.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `tests/dashboard/snapshot.test.mjs`
- `tests/dashboard/view.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/snapshot.test.mjs tests/dashboard/view.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read #100 dashboard vs CLI mismatch table
- [ ] Confirm SP-446 diagnosis values available in snapshot inputs

### Step 1: Snapshot headline

- [ ] `buildDashboardSnapshot`: headline/badge from `phase`, `diagnosis`, `endedAt`
- [ ] When `engine_orphaned`: force failed/stalled badge, not "completed"
- [ ] When `state_drift` or doneInLane pending: show resume/retry CTA

### Step 2: Regression tests

- [ ] Snapshot test: `phase: running`, `diagnosis: engine_orphaned`, `allTasksTerminalSuccess: true`, `doneInLane: true` → summary must not read "completed"
- [ ] Snapshot test: stale lane heartbeats predate `engineStartedAt` → stalled label

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update operator-runbook dashboard troubleshooting
- [ ] Close GitHub issue #100 (`gh issue close 100`)
- [ ] Update `spine-tasks/CONTEXT.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — dashboard vs CLI ground truth

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #100 closed

## Git Commit Convention

- `feat(SP-447): complete Step N — description`
- `fix(SP-447): description`

## Do NOT

- Change reconcile drift logic (SP-445/446)
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
