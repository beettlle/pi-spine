# Task: SP-520 — CONTEXT Phase 59 capstone

**Created:** 2026-07-07
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync only.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 59 table (v1.8.1 reconciliation epic) with landed status for SP-511–519 and staged SP-442, SP-445–449. Verify `dependencies.json` edges for Phase 59. Set Next Task ID to SP-521.

**Source:** [`docs/PRD-v1.8.1-reconciliation-handoff.md`](../../docs/PRD-v1.8.1-reconciliation-handoff.md)

## Dependencies

- SP-511
- SP-512
- SP-513
- SP-514
- SP-515
- SP-516
- SP-517
- SP-518
- SP-519

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm all Phase 59 leaf tasks `.DONE` on main

### Step 1: CONTEXT

- [ ] Add/update Phase 59 table with Done/Staged status
- [ ] Set Next Task ID: SP-521
- [ ] Link PRD-v1.8.1 handoff

### Step 2: dependencies.json

- [ ] Verify SP-511–520 edges present

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-511 SP-512 SP-513 SP-514 SP-515 SP-516 SP-517 SP-518 SP-519 SP-520`
- [ ] Add or update context-phase59 test if missing

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] CONTEXT Phase 59 exit criteria checkboxes updated per handoff §10
- [ ] Next Task ID SP-521

## Do NOT

- Author Phase 60 tasks in this packet — SP-521+ is separate decomposition
