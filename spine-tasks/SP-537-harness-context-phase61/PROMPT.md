# Task: SP-537 — Harness CONTEXT Phase 61 capstone

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync for v1.10.0 release harness epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 61 table (v1.10.0 release harness) with landed status for SP-530–538. Verify `dependencies.json` edges. Set **Next Task ID → SP-539**. Mark PRD §10 exit criteria.

**Source:** [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md)

## Dependencies

- SP-530
- SP-531
- SP-532
- SP-533
- SP-534
- SP-535
- SP-536
- SP-538

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-530 SP-531 SP-532 SP-533 SP-534 SP-535 SP-536 SP-538 SP-537` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-530–538 `.DONE` on main

### Step 1: CONTEXT Phase 61

- [ ] Add Phase 61 table with Done status for all harness tasks
- [ ] Update exit criteria checkboxes per PRD §10
- [ ] Set Next Task ID: SP-539
- [ ] Link PRD and release manifest path

### Step 2: dependencies.json

- [ ] Verify SP-530–538 edges present and correct

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-530 SP-531 SP-532 SP-533 SP-534 SP-535 SP-536 SP-538 SP-537`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] CONTEXT Phase 61 complete; Next Task ID → SP-539
- [ ] PRD §10 exit criteria reflected in CONTEXT

## Do NOT

- Author Phase 62 tasks

## Git Commit Convention

- `chore(SP-537): CONTEXT Phase 61 v1.10.0 capstone`
