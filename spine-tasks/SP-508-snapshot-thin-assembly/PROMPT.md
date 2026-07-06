# Task: SP-508 — Split dashboard: thin snapshot assembly

**Created:** 2026-07-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Final dashboard Strangler slice — thin `snapshot.mjs` to ≤500 LOC assembly + re-exports. Closes #177 after lane and wave extracts land.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-508-snapshot-thin-assembly/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Complete the dashboard snapshot split by thinning `src/dashboard/snapshot.mjs` to ≤500 LOC. Retain `buildDashboardSnapshot` as a thin orchestrator composing `snapshot-lanes.mjs` and `snapshot-waves.mjs`, plus any remaining shared utilities (e.g. `truncateWorktreePath`, `heartbeatAgeSeconds`). Re-export all public symbols from submodules so external importers unchanged.

**Closes:** [#177](https://github.com/beettlle/pi-spine/issues/177)

## Dependencies

- **Task:** SP-507 (wave + tail extract must land first)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/dashboard/snapshot.mjs` — remaining assembly code
- `src/dashboard/snapshot-lanes.mjs`, `src/dashboard/snapshot-waves.mjs` — prior extracts

## Environment

- **Workspace:** `src/dashboard/`
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `tests/dashboard/snapshot.test.mjs`
- `tests/dashboard/snapshot-lanes.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/dashboard/snapshot.test.mjs tests/dashboard/snapshot-lanes.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-507 complete
- [ ] Measure current `snapshot.mjs` LOC; identify code still to move or delete
- [ ] Dependencies satisfied

### Step 1: Thin snapshot.mjs assembly

- [ ] Move any remaining non-orchestration logic into `snapshot-lanes.mjs` or `snapshot-waves.mjs` if still in snapshot.mjs
- [ ] Keep `buildDashboardSnapshot` as thin composition of lane + wave modules
- [ ] Consolidate re-exports at top or bottom of snapshot.mjs
- [ ] Verify `snapshot.mjs` is ≤500 LOC

**Artifacts:**
- `src/dashboard/snapshot.mjs` (modified)
- `src/dashboard/snapshot-lanes.mjs` or `snapshot-waves.mjs` (modified only if stray logic moved)

### Step 2: Verify public API unchanged

- [ ] Grep importers of `snapshot.mjs` — no import path changes required
- [ ] Run targeted tests: `npm test -- tests/dashboard/snapshot.test.mjs tests/dashboard/snapshot-lanes.test.mjs`

**Artifacts:**
- None (verification only)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on in-scope changed code
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #177: `gh issue close 177 --comment "Dashboard snapshot split complete — SP-506/507/508"`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `snapshot.mjs` is ≤500 LOC
- [ ] All public exports preserved via re-exports
- [ ] Dashboard snapshot JSON shape unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-508): complete Step N — description`
- **Bug fixes:** `fix(SP-508): description`
- **Tests:** `test(SP-508): description`

## Do NOT

- Re-expand snapshot.mjs beyond 500 LOC
- Change dashboard JSON shape or UI contract
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
