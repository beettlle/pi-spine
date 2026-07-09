# Task: SP-557 — duplicate step number validator

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** PROMPT parse validation + skill authoring guidance.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Implement [#148](https://github.com/beettlle/pi-spine/issues/148):

1. Add duplicate `### Step N:` detection in [`src/tasks/parse-prompt.mjs`](../../src/tasks/parse-prompt.mjs) — validation error
2. Add Step B guidance in `create-spine-tasks` SKILL.md

**Closes:** [#148](https://github.com/beettlle/pi-spine/issues/148)

## Dependencies

- **Task:** SP-553

## File Scope

- `src/tasks/parse-prompt.mjs`
- `skills/create-spine-tasks/SKILL.md`
- `tests/tasks/parse-prompt-duplicate-step.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/tasks/parse-prompt-duplicate-step.test.mjs` |
| fileScopeMustChange | `src/tasks/parse-prompt.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #148 and SP-435 duplicate-step incident

### Step 1: Validator

- [ ] Detect duplicate step numbers in `parseSteps()` or validate layer
- [ ] Return actionable error with step numbers

### Step 2: Skill guidance

- [ ] Add Step B note: steps must be sequentially numbered, no duplicates

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `spine tasks validate` on a synthetic bad packet in test

### Step 4: Documentation & Delivery

- [ ] Comment on #148
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `spine tasks validate` errors on duplicate step numbers

## Git Commit Convention

- `feat(SP-557): reject duplicate PROMPT step numbers`

## Do NOT

- Renumber steps automatically in validator
