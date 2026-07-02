# Task: SP-420 — Cross-model PROMPT authoring docs

**Created:** 2026-07-02
**Size:** M

## Review Level: 0 (None)

**Assessment:** Multi-file docs/rules update; no runtime code.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Document cross-model authoring expectations for consumer repos: scoped `testCommand`, lane worktree ≠ dev checkout, reviewer context asymmetry (FR-REV-08), and self-contained PROMPT criteria. Update contract template, spine-task-authoring rule, operator runbook, and create-spine-tasks skill. Closes #84.
**Closes:** [#84](https://github.com/beettlle/pi-spine/issues/84)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #84
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/SKILL.md`
- `.cursor/rules/spine-task-authoring.mdc`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #84 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight

- [ ] Read GitHub issue #84 and reaprime batch evidence
- [ ] Read FR-REV-08 docs

### Step 1: Contract + skill updates

- [ ] Add cross-model section to contract-template.md (scoped testCommand table)
- [ ] Link cross-model section from create-spine-tasks SKILL.md

### Step 2: Operator + rule updates

- [ ] Add cross-model subsection to operator-runbook near agent model pins
- [ ] Update spine-task-authoring.mdc with reviewer context asymmetry

### Step 3: Delivery

- [ ] Close GitHub issue #84
- [ ] Verify links to #78/#80 engine issues

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #84 (`gh issue close 84`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/references/contract-template.md`
- `.cursor/rules/spine-task-authoring.mdc`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #84 closed

## Git Commit Convention

- `feat(SP-420): complete Step N — description`
- `fix(SP-420): description`
- `hydrate: SP-420 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
