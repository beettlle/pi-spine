# Task: SP-525 — Skill docs-only scope pattern

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only skill update for docs-only fileScope patterns.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-12 (docs-only scope): document **docs-only** `fileScopeMustChange` / `fileScopeMustNotChange` authoring patterns in `create-spine-tasks` ([#142](https://github.com/beettlle/pi-spine/issues/142)). Ensure doc paths appear in File Scope per #144 guidance.

**Closes:** [#142](https://github.com/beettlle/pi-spine/issues/142)

## Dependencies

- **None**

## Context to Read First

- [`skills/create-spine-tasks/SKILL.md`](../../skills/create-spine-tasks/SKILL.md)
- [`skills/create-spine-tasks/references/contract-template.md`](../../skills/create-spine-tasks/references/contract-template.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/contract-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Read #142 and #144 — docs-only scope requirements

### Step 1: Docs-only contract pattern

- [ ] Add section: `testCommand: true` + `fileScopeMustChange` listing doc deliverables (SP-214 / SP-457 lesson)
- [ ] Document when to use docs-only vs scoped node --test

### Step 2: File Scope guidance

- [ ] Add checklist row: doc paths must appear in `## File Scope` when task touches documentation

### Step 3: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] `spine tasks validate SP-525`

### Step 4: Documentation & Delivery

- [ ] Close #142
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Skill documents docs-only scope pattern with concrete example

## Do NOT

- Change validate-contract code
- List `spine-tasks/**` in must-not-change examples

## Git Commit Convention

- `docs(SP-525): docs-only fileScope pattern in create-spine-tasks`
