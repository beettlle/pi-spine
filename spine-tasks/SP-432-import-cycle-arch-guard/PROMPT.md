# Task: SP-432 — Import cycle arch guard and evidence leaf

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Arch test + small evidence/gate leaf (#83-D/E).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Complete #83: break evidence↔reconcile↔gate triangle via thin read leaf if needed; add `tests/arch/import-cycles.test.mjs` that fails on cycles in reconcile/detached-start/post-merge-limbo cluster. Closes #83.
**Closes:** [#83](https://github.com/beettlle/pi-spine/issues/83)

## Dependencies

- **Task:** SP-428 (resume-validation-detached-spawn-leaves)

## Context to Read First

- GitHub issue #83
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate-evidence-read.mjs`
- `tests/arch/import-cycles.test.mjs`
- `src/batch/evidence.mjs`
- `src/batch/gate.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 SPINE_SUPPRESS_JOURNAL_ATTACH=1 node --experimental-strip-types --test tests/arch/import-cycles.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #83 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Evidence leaf

- [ ] Extract shared read helpers if cycle remains
- [ ] Rewire evidence/gate imports

### Step 1: Arch test

- [ ] Static import graph test with zero cycles in target cluster
- [ ] Document leaf module purposes

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #83 (`gh issue close 83`)
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
- [ ] Issue #83 closed

## Git Commit Convention

- `feat(SP-432): complete Step N — description`
- `fix(SP-432): description`
- `hydrate: SP-432 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
