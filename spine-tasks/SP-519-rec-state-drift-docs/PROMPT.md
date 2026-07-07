# Task: SP-519 — State drift recovery docs

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only; closes #168 remainder from SP-496.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close [#168](https://github.com/beettlle/pi-spine/issues/168): update `skills/spine-release-operator/SKILL.md` and operator runbook so `state_drift` recovery references **valid** suggestedCommand patterns after SP-512 (not broken pause+retry on running tasks).

**Closes:** [#168](https://github.com/beettlle/pi-spine/issues/168)

## Dependencies

- SP-512

## File Scope

- `skills/spine-release-operator/SKILL.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/docs/operator-runbook-links.test.mjs` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Read #168 and SP-512 outcome

### Step 1: Docs

- [ ] Release-operator §4.4 state_drift tree matches SP-512 behavior
- [ ] Runbook recovery examples use task id in retry command

### Step 2: Testing & Verification

- [ ] Run contract testCommand (or `npm test` if no doc test)

### Step 3: Documentation & Delivery

- [ ] Close #168
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Release-operator and runbook match SP-512 suggestedCommand behavior

## Do NOT

- Re-document SP-496 #164 fix — extend for #168 only
