# Task: SP-506 — Split dashboard: lane row builders

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig extract of lane row builder functions from the 1000+ LOC `snapshot.mjs` into `snapshot-lanes.mjs`. Re-export to preserve dashboard API.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-506-snapshot-lanes-extract/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract lane row builder functions from `src/dashboard/snapshot.mjs` into `src/dashboard/snapshot-lanes.mjs` (target ≤500 LOC). Move lane projection helpers including at minimum: `buildLaneRows`, `computeActiveTaskIdsForLane`, `computeRunningTaskIdForLane`, `computeQueuedTaskIdsForLane`, `classifyLaneStatus`, `resolveLaneActivityPhase`, `resolveLaneAlert`, lane heartbeat helpers, lane log tail helpers, and their private dependencies. Re-export moved symbols from `snapshot.mjs`.

**Partial:** [#177](https://github.com/beettlle/pi-spine/issues/177)

## Dependencies

- **Task:** SP-500 (ESLint baseline must land before dashboard snapshot edits)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/dashboard/snapshot.mjs` — lane builder section (~lines 46–725)
- `tests/dashboard/snapshot-lanes.test.mjs` — existing lane tests

## Environment

- **Workspace:** `src/dashboard/`
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/snapshot-lanes.mjs`
- `tests/dashboard/snapshot-lanes.test.mjs`
- `tests/dashboard/snapshot-lane-phase.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/dashboard/snapshot-lanes.test.mjs tests/dashboard/snapshot-lane-phase.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot-lanes.mjs`, `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read lane builder functions in `snapshot.mjs`
- [ ] Review existing `snapshot-lanes.test.mjs` coverage
- [ ] Dependencies satisfied

### Step 1: Create snapshot-lanes.mjs

- [ ] Create `src/dashboard/snapshot-lanes.mjs` with extracted lane row builders
- [ ] Move private helpers (`laneEventMatches`, `journalEventTaskId`, etc.) with their callers
- [ ] Keep module ≤500 LOC

**Artifacts:**
- `src/dashboard/snapshot-lanes.mjs` (new)

### Step 2: Re-export from snapshot.mjs

- [ ] Remove moved implementations from `snapshot.mjs`
- [ ] Re-export lane symbols from `snapshot-lanes.mjs` (same export names)
- [ ] Verify `buildDashboardSnapshot` still composes lane rows correctly

**Artifacts:**
- `src/dashboard/snapshot.mjs` (modified)

### Step 3: Update tests

- [ ] Ensure `snapshot-lanes.test.mjs` imports from new module where appropriate
- [ ] Run targeted tests: `npm test -- tests/dashboard/snapshot-lanes.test.mjs tests/dashboard/snapshot-lane-phase.test.mjs`

**Artifacts:**
- `tests/dashboard/snapshot-lanes.test.mjs` (modified if needed)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `snapshot-lanes.mjs` exists and is ≤500 LOC
- [ ] Dashboard lane row shape unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-506): complete Step N — description`
- **Bug fixes:** `fix(SP-506): description`
- **Tests:** `test(SP-506): description`

## Do NOT

- Extract wave progress or tail activity (SP-507 scope)
- Change dashboard JSON shape or UI contract
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
