# Task: SP-424 — Limbo detection leaf module

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Refactor leaf; breaks reconcile↔limbo cycle (#83-A).
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extract pure `isPostMergeLimbo()` predicates to `src/batch/limbo-detect.mjs` (SP-116 strangler pattern). Break import cycle between `reconcile.mjs` and `post-merge-limbo.mjs`. Slice A of #83.
**GitHub:** [#83](https://github.com/beettlle/pi-spine/issues/83) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #83
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/limbo-detect.mjs`
- `src/batch/reconcile.mjs`
- `src/batch/post-merge-limbo.mjs`
- `tests/batch/limbo-detect.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/limbo-detect.test.mjs tests/batch/post-merge-limbo*.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #83 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Extract leaf

- [ ] Create limbo-detect.mjs with pure predicates (state readers only)
- [ ] Update reconcile + post-merge-limbo imports

### Step 1: Regression

- [ ] Run existing post-merge-limbo test suite
- [ ] Add unit tests for extracted predicates

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

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

- `feat(SP-424): complete Step N — description`
- `fix(SP-424): description`
- `hydrate: SP-424 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
