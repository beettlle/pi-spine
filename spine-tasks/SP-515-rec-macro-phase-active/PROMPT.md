# Task: SP-515 — Macro phase active workers fix

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** `deriveMacroPhase` accuracy when batch running.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Fix [#165](https://github.com/beettlle/pi-spine/issues/165): macro phase must not report `Failed` when batch phase is `running` and lane workers are active.

**Closes:** [#165](https://github.com/beettlle/pi-spine/issues/165)

## Dependencies

- SP-512

## File Scope

- `src/batch/macro-phase.mjs`
- `src/batch/diagnosis-tail-state.mjs`
- `tests/batch/macro-phase-active.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/macro-phase-active.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/macro-phase.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #165 and reproduce macro Failed + running batch

### Step 1: Fix

- [ ] Adjust macro phase derivation when workers active under drift/orphan

### Step 2: Tests

- [ ] Add macro-phase-active regression test

### Step 3: Testing & Verification

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery

- [ ] Close #165
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Macro phase not `Failed` when batch `running` and workers active

## Do NOT

- Change diagnosis taxonomy strings without updating dashboard tests
