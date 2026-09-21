# Task: SP-761 — Preserve task.laneNumber on journal rebuild after DirtyWorktree retry

**Created:** 2026-09-21
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** CRITICAL blast radius on `rebuildBatchStateFromJournal` (salvage, reconcile, resume, dashboard). Narrow change: preserve multi-lane task→lane mapping across retry; do not rewrite unrelated rebuild semantics.
**Score:** 6/8 — Blast radius: 3, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** After a multi-lane wave hits DirtyWorktree and `spine batch retry`, journal rebuild attributes every task to `laneNumber: 1`, so salvage only offers lane 1 and lanes 2+ report `lane_not_salvageable` despite commits ahead of main.

## Mission

Closes #287 — When rebuilding batch state from the journal after DirtyWorktree retry (and related rebuild paths), preserve each task's original `laneNumber` from seed state and/or prior journal events (`lane.*` / `task.*` with lane fields). Salvage `--dry-run` must list every lane with commits ahead of base. Add a regression fixture for a 3-lane DirtyWorktree→retry→rebuild timeline.

## Dependencies

- **None**

## Context to Read First

- `src/batch/journal-rebuild-structural.mjs` — `rebuildBatchStateFromJournal`, `taskStub`, lane stubs
- `src/batch/salvage-batch-list.mjs` — salvage eligibility uses rebuilt lane numbers
- `tests/batch/salvage-final-review-spawn-failed.test.mjs` — rebuild fixture patterns
- GitHub #287

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal-rebuild-structural.mjs`
- `tests/batch/journal-rebuild-lane-numbers.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/journal-rebuild-lane-numbers.test.mjs` |
| fileScopeMustChange | `src/batch/journal-rebuild-structural.mjs`, `tests/batch/journal-rebuild-lane-numbers.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce collapse: multi-lane seed + DirtyWorktree + retry events → all tasks lane 1
- [ ] Identify which journal event / seed merge drops laneNumber
- [ ] Dependencies satisfied

### Step 1: Preserve laneNumber across rebuild

- [ ] Prefer last known finite `laneNumber` from seed task / journal events over defaulting to 1
- [ ] Ensure lane stubs keep distinct laneNumbers for multi-lane waves after retry
- [ ] Regression test: 3 tasks on lanes 1–3 remain on those lanes after rebuild

**Artifacts:**
- `src/batch/journal-rebuild-structural.mjs` (modified)
- `tests/batch/journal-rebuild-lane-numbers.test.mjs` (new)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (operator salvage docs in SP-766)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — salvage multi-lane notes

## Completion Criteria

- [ ] Rebuild preserves per-task laneNumber after DirtyWorktree retry
- [ ] Regression test covers 3-lane case
- [ ] Closes #287

## Git Commit Convention

- `fix(SP-761): preserve laneNumber on journal rebuild after DirtyWorktree retry (#287)`

## Do NOT

- Broadly rewrite journal rebuild unrelated to lane assignment
- Change salvage integrate merge strategy beyond reading correct laneNumbers
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
