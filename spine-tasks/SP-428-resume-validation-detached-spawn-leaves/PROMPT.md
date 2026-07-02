# Task: SP-428 — Resume validation and detached spawn leaves

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Two leaf extractions (#83-B/C).
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Break remaining reconcile cycles (#83): extract pure resume validation helpers to a leaf module and detached spawn argv builders to `detached-spawn.mjs` so post-merge-limbo does not import full detached-start.mjs.
**GitHub:** [#83](https://github.com/beettlle/pi-spine/issues/83) (partial)

## Dependencies

- **Task:** SP-424 (limbo-detect-leaf)

## Context to Read First

- GitHub issue #83
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-validation.mjs`
- `src/batch/detached-spawn.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/post-merge-limbo.mjs`
- `tests/arch/import-cycles.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/arch/import-cycles.test.mjs tests/batch/detached-start*.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #83 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Resume validation leaf

- [ ] Move pure validation helpers out of resume-multi-validate.mjs
- [ ] No reconcile import in leaf

### Step 1: Detached spawn leaf

- [ ] Extract spawn argv builders to detached-spawn.mjs
- [ ] Rewire post-merge-limbo imports

### Step 2: Arch guard

- [ ] Add import-cycles test with shrinking allowlist for reconcile/detached-start/limbo cluster

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue with progress
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


## Git Commit Convention

- `feat(SP-428): complete Step N — description`
- `fix(SP-428): description`
- `hydrate: SP-428 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
