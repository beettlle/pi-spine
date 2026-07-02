# Task: SP-423 — Sequence preflight .pi/ and error propagation

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** CLI preflight UX; small surface.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When `spine run sequence` preflight fails (e.g. untracked `.pi/`), print the same remediation as `spine preflight` instead of silent exit 1. Exclude `.pi/` from git-clean check (like `.spine/runtime`). Closes #81.
**Closes:** [#81](https://github.com/beettlle/pi-spine/issues/81)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #81
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/spine-preflight-lib.mjs`
- `src/batch/sequence.mjs`
- `tests/batch/sequence-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-preflight.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #81 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight git-clean

- [ ] Exclude `.pi/` from git-clean dirty paths
- [ ] Document in spine init gitignore guidance if needed

### Step 1: Sequence error surfacing

- [ ] Propagate preflight failure reason to sequence CLI stderr
- [ ] Exit non-zero with actionable message

### Step 2: Tests

- [ ] Test sequence with only `?? .pi/` succeeds or warns
- [ ] Test preflight failure prints message

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #81 (`gh issue close 81`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — `.pi/` preflight note

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #81 closed

## Git Commit Convention

- `feat(SP-423): complete Step N — description`
- `fix(SP-423): description`
- `hydrate: SP-423 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
