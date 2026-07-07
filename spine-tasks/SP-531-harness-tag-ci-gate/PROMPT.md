# Task: SP-531 — Harness tag CI gate

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Release workflow + skill wiring for CI-green-before-tag; touches release.yml verify step and operator skill.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-21: tag creation must be gated on a **release-safe CI profile** green on the target commit ([#156](https://github.com/beettlle/pi-spine/issues/156)). Wire release-operator Phase 6 to verify CI status before `git push --tags` and document the gate in skill + release docs.

**Closes:** [#156](https://github.com/beettlle/pi-spine/issues/156)

## Dependencies

- **Task:** SP-530 (release:check skill gate baseline)

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-21
- [`.github/workflows/release.yml`](../../.github/workflows/release.yml) CI gate step
- [`docs/release/npm-publish.md`](../../docs/release/npm-publish.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-release-operator/SKILL.md`
- `.github/workflows/release.yml`
- `docs/release/npm-publish.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/release-workflow.test.mjs` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md` |

## Steps

### Step 0: Preflight

- [ ] Read issue #156 and release.yml `ci_gate` step
- [ ] Confirm SP-530 landed (release:check skill gate)

### Step 1: Release-operator tag gate

- [ ] Phase 6: before `git push --tags`, require `gh run list` / `gh run watch` on CI workflow for HEAD commit — fail closed if no green CI
- [ ] Document release-safe profile: typecheck + lint + tests + coverage (same as `ci.yml`)

### Step 2: Workflow and docs

- [ ] Ensure `release.yml` fails publish when CI failed on tagged commit (verify or tighten messaging)
- [ ] Update `docs/release/npm-publish.md` pre-publish checklist with CI gate step

### Step 3: Tests

- [ ] Add or extend `tests/cli/release-workflow.test.mjs` for CI gate documentation/skill contract strings

### Step 4: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 5: Documentation & Delivery

- [ ] Comment on #156
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Operator skill documents CI-green requirement before tag push
- [ ] Release docs and workflow align on release-safe CI profile

## Do NOT

- Bypass release.yml CI gate with manual publish without operator override
- Change unrelated workflow jobs

## Git Commit Convention

- `feat(SP-531): gate tag push on release-safe CI profile`
