# Task: SP-419 — Spine-orchestrate skill and slash command

**Created:** 2026-07-02
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** New pi skill + slash; touches extensions and skills tree.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Ship discoverability surfaces for agent-orchestrated waves per #90: pi skill `spine-orchestrate-waves` (SKILL.md + references synced from SP-418 doc) and slash command `/spine-orchestrate` that emits wave plan + outer-loop checklist from `spine plan` — **no** auto gate approve/integrate. Closes #90.
**Closes:** [#90](https://github.com/beettlle/pi-spine/issues/90)

## Dependencies

- **Task:** SP-418 (agent-outer-loop-doc)

## Context to Read First

- GitHub issue #90
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-orchestrate-waves/**`
- `extensions/spine/slash-commands.ts`
- `package.json`
- `tests/extensions/spine-orchestrate-slash.test.ts`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/extensions/spine-orchestrate-slash.test.ts && npm run coverage:check` |
| fileScopeMustChange | `skills/spine-orchestrate-waves/SKILL.md` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #90 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight

- [ ] Read SP-418 doc
- [ ] Read existing slash-commands.ts patterns

### Step 1: Skill package

- [ ] Create `skills/spine-orchestrate-waves/SKILL.md` with triggers and decision tree
- [ ] Add `references/outer-loop.md` synced from docs/adoption/agent-orchestrated-waves.md

### Step 2: Slash command

- [ ] Add `/spine-orchestrate [pending|all] [--from-wave N]`
- [ ] Emit structured prompt: wave tasks + outer loop steps + skill link

### Step 3: Wire package + tests

- [ ] Register skill in package.json
- [ ] Add slash command unit test

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #90 (`gh issue close 90`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/agent-orchestrated-waves.md` — note skill/slash surfaces

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #90 closed

## Git Commit Convention

- `feat(SP-419): complete Step N — description`
- `fix(SP-419): description`
- `hydrate: SP-419 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
