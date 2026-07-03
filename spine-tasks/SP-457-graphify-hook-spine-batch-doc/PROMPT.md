# Task: SP-457 — Graphify hook spine batch doc

**Created:** 2026-07-02
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only for graphify post-commit vs spine lanes.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Document `graphify hook install` interaction with spine lane commits; recommend `graphify-out/` gitignored in consumer repos ([#113](https://github.com/beettlle/pi-spine/issues/113) partial).
**Closes:** [#113](https://github.com/beettlle/pi-spine/issues/113) (partial)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #113
- `docs/adoption/operator-runbook.md`
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

- [ ] Read GitHub issue #113 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Author section

- [ ] graphify post-commit dirty worktree pattern
- [ ] Mitigation: gitignore graphify-out
- [ ] Link SP-463 code fix

### Step 2: Cross-link

- [ ] QUICK-REFERENCE troubleshooting pointer

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #113 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — graphify hook + spine batch

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-457): complete Step N — description`
- `fix(SP-457): description`
- `hydrate: SP-457 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
