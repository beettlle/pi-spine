# Task: SP-523 — Skill scoped testCommand guidance

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only skill update; no application code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-12 (partial): update `create-spine-tasks` skill with **scoped `node --test`** Contract template, examples, and anti-pattern table for `npm test -- <file>` ([#141](https://github.com/beettlle/pi-spine/issues/141)).

**Closes:** [#141](https://github.com/beettlle/pi-spine/issues/141) (documentation remainder)

## Dependencies

- **Task:** SP-522 (validate behavior finalized)

## Context to Read First

- [`skills/create-spine-tasks/SKILL.md`](../../skills/create-spine-tasks/SKILL.md)
- [`skills/create-spine-tasks/references/contract-template.md`](../../skills/create-spine-tasks/references/contract-template.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/references/prompt-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md`, `skills/create-spine-tasks/references/contract-template.md` |

## Steps

### Step 0: Preflight

- [ ] Read SP-522 warning messages — align skill text with validate hints

### Step 1: Contract template

- [ ] Add `node --test` example as default code-task `testCommand` in contract-template.md
- [ ] Document why `npm test -- path` is forbidden (runs full suite in lanes)

### Step 2: Skill checklist

- [ ] Add P1 authoring warning row: scoped testCommand, wave >8 (cross-ref SP-524), docs-only scope (cross-ref SP-525)
- [ ] Update prompt-template Testing step example to use `node --test`

### Step 3: Testing & Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] `spine tasks validate SP-523`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] create-spine-tasks skill documents scoped `node --test` pattern (PRD §10 exit criteria)

## Do NOT

- Change validator code (SP-522 owns implementation)
- Ban `spine-tasks/**` in must-not-change examples

## Git Commit Convention

- `docs(SP-523): scoped testCommand guidance in create-spine-tasks`
