# Task: SP-514 — v1.8.1 incident fixtures

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Test fixtures only; regression guard for Phase 59.
**Score:** 3/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add incident regression fixtures for batches `20260705T210857` (#170) and `20260706T052912` (#184). Integration tests replay journals and assert reconcile/diagnosis outcomes after SP-512 and SP-513 fixes.

## Dependencies

- SP-512
- SP-513

## File Scope

- `tests/fixtures/incidents/v181-batch-20260705T210857.json`
- `tests/fixtures/incidents/v181-batch-20260706T052912.json`
- `tests/batch/incident-replay-v181.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/incident-replay-v181.test.mjs` |
| fileScopeMustChange | `tests/fixtures/incidents/v181-batch-20260705T210857.json` |
| artifactsMustExist | `tests/batch/incident-replay-v181.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-512/513 implementations and journal exports

### Step 1: Fixtures

- [ ] Capture minimal journal + batch-state snapshots for both batches
- [ ] Document expected post-reconcile state in test comments

### Step 2: Tests

- [ ] `incident-replay-v181.test.mjs` replays and asserts terminal reconcile

### Step 3: Testing & Verification

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery

- [ ] Reference fixtures in operator runbook incident index
- [ ] Create `.DONE`

## Completion Criteria

- [ ] CI replays both incidents without manual batch-state edits

## Do NOT

- Commit full production journal dumps with secrets — sanitize fixtures
