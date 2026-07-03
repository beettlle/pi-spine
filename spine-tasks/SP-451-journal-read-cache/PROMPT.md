# Task: SP-451 — Journal read cache

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Shared mtime-keyed journal cache; localized to journal + consumers.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add journal read cache invalidated on journal file mtime; share parsed events across `collectProgressSignals`, attached milestone reporter, and dashboard snapshot paths. Reduces orchestrator CPU during idle monitoring ([#98](https://github.com/beettlle/pi-spine/issues/98) P0).
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #98 P0
- `src/batch/journal.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/journal.mjs`
- `src/batch/heartbeat.mjs`
- `src/batch/attached-runner.mjs`
- `tests/batch/journal-cache.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/journal-cache.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/journal.mjs` |
| artifactsMustExist | `tests/batch/journal-cache.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Cache API

- [ ] Add `readJournalEventsCached` with mtime invalidation
- [ ] Export cache clear/invalidate for tests

### Step 2: Wire consumers

- [ ] Replace direct full reads in heartbeat progress signals
- [ ] Replace attached milestone reporter journal read
- [ ] Dashboard snapshot uses cache when available

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #98 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — note journal cache behavior

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-451): complete Step N — description`
- `fix(SP-451): description`
- `hydrate: SP-451 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
