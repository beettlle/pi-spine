# Task: SP-441 — Batch complete stale batch-state fix

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Batch state machine correctness.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When `spine batch complete` archives a batch and a new batch starts immediately, batch-state must point at the active batch — not stale completed ID. `spine watch`/`spine status` show active batch. Closes #94.
**Closes:** [#94](https://github.com/beettlle/pi-spine/issues/94)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #94
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-state-io.mjs`
- `src/batch/lifecycle.mjs`
- `src/cli/batch-complete.mjs`
- `tests/batch/batch-state-handoff.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/batch-state-handoff.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #94 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: State handoff

- [ ] batch start refuses or updates when prior complete left stale pointer
- [ ] Atomic transition complete → start

### Step 1: Regression

- [ ] Reproduce 073511 vs 073937 timeline

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #94 (`gh issue close 94`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None beyond File Scope

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #94 closed

## Git Commit Convention

- `feat(SP-441): complete Step N — description`
- `fix(SP-441): description`
- `hydrate: SP-441 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
