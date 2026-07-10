# Task: SP-582 — Extract sequence-plan.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of sequence.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `sequence-plan.mjs` — `buildSequencePlan`, `resolveSequenceWaves`, release profile validators, dry-run builders. Leave `runSequence` for SP-600.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-599 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/sequence.mjs`
- `src/batch/sequence-plan.mjs`
- `tests/batch/sequence-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/sequence-preflight.test.mjs` |
| fileScopeMustChange | `src/batch/sequence-plan.mjs`, `src/batch/sequence.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for sequence.mjs
- [ ] List public exports to preserve

### Step 1: Extract sequence-plan.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from sequence.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/sequence-preflight.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-582): extract sequence-plan.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
