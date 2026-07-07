# Task: SP-516 — Status classification alignment after retry

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Task status vs classification divergence after retry/resume.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix [#166](https://github.com/beettlle/pi-spine/issues/166): align `status` and `classification` fields after retry/resume so operators do not see `failed` vs `terminal-success` divergence.

**Closes:** [#166](https://github.com/beettlle/pi-spine/issues/166)

## Dependencies

- SP-512

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/status-classification-align.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/status-classification-align.test.mjs` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/reconcile.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read #166 and v1.6.0 batch `20260704T233623` context

### Step 1: Fix

- [ ] On retry/resume, sync classification with reconciled terminal state

### Step 2: Tests

- [ ] Regression test for post-retry classification

### Step 3: Testing & Verification

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery

- [ ] Close #166
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Post-retry/resume status and classification agree in diagnose output

## Do NOT

- Break SP-512 terminal reconcile behavior
