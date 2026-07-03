# Task: SP-466 — Spine orchestrate skill package

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Skill package only; split from SP-419.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Create pi skill `spine-orchestrate-waves` (SKILL.md + references synced from SP-418 doc). Split from SP-419; slash command is SP-467. Partial [#90](https://github.com/beettlle/pi-spine/issues/90).

## Dependencies

- **Task:** SP-418 (agent-outer-loop-doc)

## Context to Read First

- GitHub issue #90
- `docs/adoption/agent-orchestrated-waves.md`
- Parent split: SP-419
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-orchestrate-waves/SKILL.md`
- `skills/spine-orchestrate-waves/references/outer-loop.md`
- `package.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `test -f skills/spine-orchestrate-waves/SKILL.md` |
| fileScopeMustChange | `skills/spine-orchestrate-waves/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #90 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Skill package

- [ ] Create SKILL.md with triggers and decision tree
- [ ] Add references/outer-loop.md synced from agent-orchestrated-waves.md
- [ ] Register skill in package.json

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #90 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/agent-orchestrated-waves.md` — note skill surface

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-466): complete Step N — description`
- `fix(SP-466): description`
- `hydrate: SP-466 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
