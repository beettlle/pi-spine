# Task: SP-558 — create-spine-tasks skill authoring polish

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only skill template updates for deferred authoring issues.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `create-spine-tasks` skill and prompt template for:

1. **#146** — Parent split pattern in Context to Read First
2. **#147** — Standardize issue-link format (`Closes #N` vs `Partial #N`)
3. **#149** — Do NOT template: `.spine/`, `AGENTS.md`, `CLAUDE.md`, `.gitnexus/`
4. **#150** — Review Level 2+ environment compatibility note

**Partial:** [#146](https://github.com/beettlle/pi-spine/issues/146), [#147](https://github.com/beettlle/pi-spine/issues/147), [#149](https://github.com/beettlle/pi-spine/issues/149), [#150](https://github.com/beettlle/pi-spine/issues/150)

## Dependencies

- **Task:** SP-553

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read issues #146–#150

### Step 1: SKILL.md updates

- [ ] Parent split, issue-link, Do NOT, Review Level env sections

### Step 2: prompt-template.md

- [ ] Mirror template changes with examples

### Step 3: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Comment on #146–#150
- [ ] Create `.DONE`

## Completion Criteria

- [ ] All four issue acceptance items reflected in skill + template

## Git Commit Convention

- `docs(SP-558): create-spine-tasks authoring polish #146-150`

## Do NOT

- Modify engine code
