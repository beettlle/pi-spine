# Task: SP-725 — Separate maxCodeReviewAttempts / maxPlanReviewAttempts

**Created:** 2026-08-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Config + review phase wiring; medium blast in review.mjs.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #265 — Add `review.maxCodeReviewAttempts` and `review.maxPlanReviewAttempts` with fallback to `maxFinalAttempts` when unset. Wire `review.mjs` phase runners; update settings-fields and config defaults tests. Diagnosis copy must name the exhausted phase. Land **before** SP-727–730 review split.

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/review.mjs` — attempt caps
- `src/config/settings-fields.mjs`
- `tests/config/config-defaults-v2.test.mjs`
- GitHub #265

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/config/settings-fields.mjs`
- `src/config/defaults.mjs`
- `tests/config/config-defaults-v2.test.mjs`
- `tests/batch/final-verdict.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/config/config-defaults-v2.test.mjs tests/batch/final-verdict.test.mjs` |
| fileScopeMustChange | `src/config/settings-fields.mjs` |

## Steps

### Step 1: Config schema + defaults

- [ ] Add maxCodeReviewAttempts and maxPlanReviewAttempts to REVIEW_DEFAULTS / settings-fields
- [ ] Unset keys fall back to maxFinalAttempts (backward compatible)

### Step 2: Wire phase runners

- [ ] Use independent caps in code / final / plan review phases
- [ ] Journal or diagnosis names exhausted phase

### Step 3: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- Config / settings docs if operator-facing keys are documented

## Completion Criteria

- [ ] Independent caps with fallback
- [ ] Closes #265
- [ ] `.DONE` created

## Do NOT

- Change default attempt counts without need
- Start review.mjs module split (SP-727+)
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `feat(SP-725): separate review attempt caps (#265)`
