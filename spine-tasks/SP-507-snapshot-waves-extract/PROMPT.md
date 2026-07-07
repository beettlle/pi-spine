# Task: SP-507 — Split dashboard: wave + tail activity builders

**Created:** 2026-07-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig extract of wave progress and tail activity builders from `snapshot.mjs` into `snapshot-waves.mjs`. Depends on lane extract landing first.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Canonical Task Folder

```
spine-tasks/SP-507-snapshot-waves-extract/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Extract wave progress and tail activity builders from `src/dashboard/snapshot.mjs` into `src/dashboard/snapshot-waves.mjs` (target ≤500 LOC). Move at minimum: `buildWaveProgress`, `resolveWaveStatus` (private), `resolveTailActivityFromJournal`, `resolveTailActivityLabel`, `formatJournalTailEntry`, `buildDefaultViewStatus`, and related private helpers (`summarizeBatch`, `isBatchNonTerminal`, etc.). Re-export from `snapshot.mjs`.

**Partial:** [#177](https://github.com/beettlle/pi-spine/issues/177)

## Dependencies

- **Task:** SP-506 (lane row builders must land first — same snapshot.mjs file)

## Context to Read First

**Tier 3 (load only if needed):**
- `src/dashboard/snapshot.mjs` — wave and tail sections (~lines 508–895)
- `src/dashboard/snapshot-lanes.mjs` — prior extract pattern

## Environment

- **Workspace:** `src/dashboard/`
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/snapshot-waves.mjs`
- `tests/dashboard/snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/dashboard/snapshot.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/dashboard/snapshot-waves.mjs`, `src/dashboard/snapshot.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-506 complete
- [ ] Read wave progress and tail activity functions in `snapshot.mjs`
- [ ] Dependencies satisfied

### Step 1: Create snapshot-waves.mjs

- [ ] Create `src/dashboard/snapshot-waves.mjs` with wave and tail activity builders
- [ ] Move private wave/tail helpers with their public callers
- [ ] Keep module ≤500 LOC

**Artifacts:**
- `src/dashboard/snapshot-waves.mjs` (new)

### Step 2: Re-export from snapshot.mjs

- [ ] Remove moved implementations from `snapshot.mjs`
- [ ] Re-export wave/tail symbols from `snapshot-waves.mjs`
- [ ] Verify `buildDashboardSnapshot` still assembles wave progress and tail activity

**Artifacts:**
- `src/dashboard/snapshot.mjs` (modified)

### Step 3: Update tests

- [ ] Extend or adjust `snapshot.test.mjs` for extracted wave/tail modules
- [ ] Run targeted tests: `npm test -- tests/dashboard/snapshot.test.mjs`

**Artifacts:**
- `tests/dashboard/snapshot.test.mjs` (modified if needed)

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
- [ ] `snapshot-waves.mjs` exists and is ≤500 LOC
- [ ] Dashboard wave/tail JSON shape unchanged

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-507): complete Step N — description`
- **Bug fixes:** `fix(SP-507): description`
- **Tests:** `test(SP-507): description`

## Do NOT

- Thin snapshot.mjs to final ≤500 LOC (SP-508 scope)
- Change dashboard JSON shape
- Skip tests
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
