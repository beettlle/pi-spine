# Task: SP-437 — Sequence continue after merge_blocked wave

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Sequence wave iteration policy.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When wave N hits merge_blocked with partial success, sequence should continue independent later waves (per dependencies.json) or print explicit skip rationale — not silently exit after wave 0. Closes #82.
**Closes:** [#82](https://github.com/beettlle/pi-spine/issues/82)

## Dependencies

- **Task:** SP-387 (sequence-runner-core-loop)

## Context to Read First

- GitHub issue #82
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/sequence.mjs`
- `src/batch/sequence-waves.mjs`
- `tests/batch/sequence-merge-blocked-continue.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/sequence-merge-blocked-continue.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #82 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Wave policy

- [ ] Evaluate deps for waves 1+ when wave 0 merge_blocked
- [ ] Continue or emit structured skip message per §17.4

### Step 1: Tests + docs

- [ ] Fixture: 3-wave plan, wave 0 partial → wave 1 starts if deps allow

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #82 (`gh issue close 82`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — sequence partial wave behavior

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #82 closed

## Git Commit Convention

- `feat(SP-437): complete Step N — description`
- `fix(SP-437): description`
- `hydrate: SP-437 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
