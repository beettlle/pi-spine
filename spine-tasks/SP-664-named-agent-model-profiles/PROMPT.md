# Task: SP-664 — Named agent-model profiles

## Mission

Closes #216

Allow `spine-config` to define named agent model profiles (e.g., `default`, `hard`) and an optional auto-escalate policy.
This feature lets the operator define `agents.profiles.<name>` mirroring the current `worker`/`reviewer`/`supervisor` shape, and set `agents.activeProfile` to switch the live profile via settings.

## Do NOT

- Do NOT modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Dependencies

- **None**

## Context to Read First

- `src/config/spine-config-schema.mjs`
- `src/config/load.mjs`

## File Scope

- `src/config/spine-config-schema.mjs`
- `src/config/load.mjs`
- `src/cli/settings.mjs`
- `src/cli/doctor.mjs`
- `tests/config/load.test.mjs`

## Contract

| Field | Value |
| --- | --- |
| testCommand | `node --test tests/config/load.test.mjs` |
| fileScopeMustChange | `src/config/spine-config-schema.mjs` |

## Steps

### Step 0: Config Schema Updates

- Add `agents.profiles` to schema.
- Add `agents.activeProfile` to schema.
- Add optional `agents.escalatePolicy` to schema.

**Plan-review checkpoint**
> `spine_review_step {"step": 0, "type": "plan"}`

### Step 1: Implementation

- Update `load.mjs` to apply the `activeProfile` over the base `agents` config.
- Update `doctor.mjs` to validate all profile model IDs.
- Update `settings.mjs` to support switching the active profile.

**Code review checkpoint**
> `spine_review_step {"step": 1, "type": "code"}`

### Step 2: Testing & Verification

- [ ] Tests pass
- [ ] Coverage ≥ 77%

**Code review checkpoint**
> `spine_review_step {"step": 2, "type": "code"}`

## Completion Criteria

- `spine doctor` validates named profiles.
- Operator can use `spine settings set agents.activeProfile <name>`.
- Worker creates `.DONE`.

## Git Commit Convention

- `feat(SP-664): ...`
- `fix(SP-664): ...`
