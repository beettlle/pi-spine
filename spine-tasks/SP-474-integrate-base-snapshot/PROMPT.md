# Task: SP-474 — Integrate base branch snapshot

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** #91 slice 1a; split from SP-436.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Record `baseBranchHeadAtStart` on batch start and journal `batch.base_snapshot` ([#91](https://github.com/beettlle/pi-spine/issues/91) / FR-WT-08 slice 1a). Split from SP-436.

## Dependencies

- **None**

## Context to Read First

- GitHub issue #91
- `src/batch/lifecycle.mjs`
- Parent split: SP-436
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/batch-state-io.mjs`
- `tests/batch/integrate-base-snapshot.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-base-snapshot.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| artifactsMustExist | `tests/batch/integrate-base-snapshot.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Batch snapshot

- [ ] Record baseBranchHeadAtStart in batch state on batch start
- [ ] Emit journal batch.base_snapshot event

### Step 2: Tests

- [ ] Assert snapshot persisted and journaled on start

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #91 with progress
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

- `feat(SP-474): complete Step N — description`
- `fix(SP-474): description`
- `hydrate: SP-474 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
