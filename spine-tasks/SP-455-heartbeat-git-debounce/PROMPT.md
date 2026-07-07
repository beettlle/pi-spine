# Task: SP-455 — Heartbeat git porcelain debounce

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Debounce git status in heartbeat when mtimes unchanged.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Skip `git status --porcelain` in `collectProgressSignals` when file-scope mtimes unchanged since last check ([#98](https://github.com/beettlle/pi-spine/issues/98) P1).
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98) (partial)

## Dependencies

- **Task:** SP-451 (journal cache reduces paired I/O)

## Context to Read First

- GitHub issue #98 P1
- `src/batch/heartbeat.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/heartbeat-git-debounce.mjs`
- `tests/batch/heartbeat-git-debounce.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/batch/heartbeat-git-debounce.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/batch/heartbeat-git-debounce.mjs`, `tests/batch/heartbeat-git-debounce.test.mjs` |
| artifactsMustExist | `tests/batch/heartbeat-git-debounce.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Debounce logic

- [ ] Track last file-scope mtime snapshot per lane
- [ ] Skip git porcelain when unchanged

### Step 2: Tests

- [ ] Assert git not called when mtimes stable
- [ ] Assert git runs when scope file touched

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
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-455): complete Step N — description`
- `fix(SP-455): description`
- `hydrate: SP-455 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)

- fileScopeMustChange updated from `src/batch/heartbeat.mjs` (pre-landed by SP-451) to `tests/batch/heartbeat-git-debounce.test.mjs` — the delivery artifact that must still be created.
- Extracted debounce logic to `src/batch/heartbeat-git-debounce.mjs` to keep `heartbeat.mjs` under 500 LOC (phase23 batch-loc-policy).
- testCommand updated to use `node --experimental-strip-types --test` instead of `npm test -- <path>` (npm test runs full suite, not scoped file).
