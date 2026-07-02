# Task: SP-439 — Integrate false merge conflict fix

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Integrate land loop correctness.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix `spine integrate` reporting merge conflict when manual `git merge` fast-forwards cleanly (batch 20260702T071449). Closes #93.
**Closes:** [#93](https://github.com/beettlle/pi-spine/issues/93)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #93
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/rules-manifest-drift.mjs`
- `tests/batch/integrate-fast-forward.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-fast-forward.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #93 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Reproduce

- [ ] Fixture from batch 20260702T071449 orch branch fast-forward

### Step 1: Merge path fix

- [ ] Detect fast-forward capable state before failing
- [ ] Fix rules-manifest drift false conflict

### Step 2: Regression test

- [ ] integrate succeeds on clean FF scenario

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #93 (`gh issue close 93`)
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
- [ ] Issue #93 closed

## Git Commit Convention

- `feat(SP-439): complete Step N — description`
- `fix(SP-439): description`
- `hydrate: SP-439 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
