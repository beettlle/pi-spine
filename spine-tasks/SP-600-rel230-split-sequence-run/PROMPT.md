# Task: SP-600 — Extract sequence-run.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of sequence.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `sequence-run.mjs` — `runSequence`, `runSequenceWaveLandLoop`, `waitForSequenceBatchTerminal`. Thin `sequence.mjs` ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-582

## File Scope

- `src/batch/sequence.mjs`
- `src/batch/sequence-plan.mjs`
- `tests/batch/sequence-release-profile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/sequence-release-profile.test.mjs` |
| fileScopeMustChange | `src/batch/sequence-run.mjs`, `src/batch/sequence.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-582 complete

### Step 1: Complete split

- [ ] Move remainder; thin `sequence.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/sequence-release-profile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `sequence.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-600): complete sequence.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
