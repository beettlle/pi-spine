# Task: SP-454 — Orchestrator process model docs

**Created:** 2026-07-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only; documents expected node process count.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Document orchestrator transparency: which node processes are normal vs leak; link poll-budget mitigations and `spine doctor` maxParallel guidance. Completes [#98](https://github.com/beettlle/pi-spine/issues/98) operator-facing acceptance.
**Closes:** [#98](https://github.com/beettlle/pi-spine/issues/98)

## Dependencies

- **Task:** SP-451, SP-452, SP-453 (document shipped behavior)

## Context to Read First

- GitHub issue #98 acceptance criteria
- `spine-tasks/CONTEXT.md` Phase 54
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #98 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Runbook section

- [ ] Add process model table (pi vs spine vs harness)
- [ ] Document poll config keys and mitigations

### Step 2: Cross-links

- [ ] QUICK-REFERENCE pointer
- [ ] Link from doctor maxParallel section

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #98 (`gh issue close 98`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — orchestrator process model + NFR-PERF-03 sketch

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #98 closed

## Git Commit Convention

- `feat(SP-454): complete Step N — description`
- `fix(SP-454): description`
- `hydrate: SP-454 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
