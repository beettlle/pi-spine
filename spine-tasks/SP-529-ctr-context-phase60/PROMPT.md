# Task: SP-529 — CONTEXT Phase 60 capstone

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync for v1.9.0 epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 60 table (v1.9.0 contract guardrails) with landed status for SP-522–528 and prior Phase 60 tasks (SP-373, SP-374, SP-410–417, SP-478, SP-479). Verify `dependencies.json` edges. Set **Next Task ID → SP-530**. Mark PRD §10 exit criteria.

**Source:** [`docs/PRD-v1.9.0-contract-guardrails-handoff.md`](../../docs/PRD-v1.9.0-contract-guardrails-handoff.md)

## Dependencies

- SP-522
- SP-523
- SP-524
- SP-525
- SP-526
- SP-527
- SP-528

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-522 SP-523 SP-524 SP-525 SP-526 SP-527 SP-528 SP-529` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-522–528 `.DONE` on main

### Step 1: CONTEXT Phase 60

- [ ] Add Phase 60 table with Done status for all SP-CTR tasks
- [ ] Update exit criteria checkboxes per PRD §10
- [ ] Set Next Task ID: SP-530
- [ ] Remove "Future phases" stub for Phase 60

### Step 2: dependencies.json

- [ ] Verify SP-522–529 edges present and correct

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-522 SP-523 SP-524 SP-525 SP-526 SP-527 SP-528 SP-529`
- [ ] Add or update `tests/tasks/context-phase60.test.mjs` if missing

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] CONTEXT Phase 60 complete; Next Task ID → SP-530
- [ ] PRD §10 exit criteria reflected in CONTEXT

## Do NOT

- Author Phase 61 tasks

## Git Commit Convention

- `chore(SP-529): CONTEXT Phase 60 v1.9.0 capstone`
