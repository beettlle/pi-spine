# Task: SP-393 — Sequence supervisor daemon explore

**Created:** 2026-06-30
**Size:** L

## Review Level: 1 (Plan Only)

**Assessment:** Explore-only for issue #54 Tier 3; no product code required.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Explore **GitHub issue #54** Tier 3 (SP-G deferred): document detached supervisor choreographer design (dashboard-triggered, survives CLI exit, resumes after human gate). Output findings only — no daemon implementation.

## Dependencies

- **Task:** SP-392 (Tier 2 sequence landed)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/_explore/sequence-supervisor/findings.md`
- `spine-tasks/SP-393-sequence-supervisor-explore/STATUS.md`
- `spine-tasks/SP-393-sequence-supervisor-explore/PROMPT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/SP-393-sequence-supervisor-explore/STATUS.md` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 Tier 3 and SP-368 explore pattern

### Step 1: Explore findings

- [ ] Write findings.md: process model, state artifacts, failure modes, deps on limbo recovery
- [ ] Link in CONTEXT.md explore table

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (no regressions from doc-only delivery)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Do not close #54 (already closed by SP-392)

## Documentation Requirements

**Must Update:**
- `spine-tasks/_explore/sequence-supervisor/findings.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-393): complete Step N — description`
- `fix(SP-393): description`
- `test(SP-393): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
