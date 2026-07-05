# Task: SP-469 — Detached spawn leaf

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** #83-C leaf extraction; split from SP-428.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract detached spawn argv builders to `detached-spawn.mjs`; rewire post-merge-limbo so it does not import full detached-start.mjs ([#83](https://github.com/beettlle/pi-spine/issues/83) slice C). Split from SP-428.

## Dependencies

- **Task:** SP-424, SP-468

## Context to Read First

- GitHub issue #83 slice C
- `src/batch/detached-start.mjs`, `post-merge-limbo.mjs`
- Parent split: SP-428
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/detached-spawn.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/post-merge-limbo.mjs`
- `tests/arch/import-cycles.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs tests/batch/detached-start.test.mjs tests/batch/detached-start-land-loop.test.mjs tests/batch/detached-start-orphan-timeout.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/detached-spawn.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #83 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Detached spawn leaf

- [ ] Extract spawn argv builders to detached-spawn.mjs
- [ ] Rewire post-merge-limbo imports

### Step 2: Arch guard

- [ ] Update import-cycles test allowlist for detached-start/limbo cluster

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #83 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-469): complete Step N — description`
- `fix(SP-469): description`
- `hydrate: SP-469 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
