# Task: SP-564 — CONTEXT Phase 63 capstone

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT + dependencies sync for v2.1.0 release epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 63 table with landed status for SP-552–563. Verify `dependencies.json` edges. Set **Next Task ID → SP-565**. Mark PRD §8 exit criteria per operator attestation.

**Source:** [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](../../docs/PRD-v2.1.0-backlog-drain-handoff.md)

## Dependencies

- SP-552
- SP-553
- SP-554
- SP-555
- SP-556
- SP-557
- SP-558
- SP-559
- SP-560
- SP-561
- SP-562
- SP-563

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`
- `docs/release/manifest-v2.1.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-552 SP-553 SP-554 SP-555 SP-556 SP-557 SP-558 SP-559 SP-560 SP-561 SP-562 SP-563 SP-564` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-552–563 `.DONE` on main

### Step 1: CONTEXT Phase 63

- [ ] Add Phase 63 table with Done status
- [ ] Update PRD §8 exit criteria checkboxes
- [ ] Set Next Task ID: SP-565
- [ ] Link manifest

### Step 2: dependencies.json

- [ ] Verify SP-552–564 edges

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] CONTEXT Phase 63 complete; Next Task ID → SP-565

## Git Commit Convention

- `chore(SP-564): CONTEXT Phase 63 v2.1.0 capstone`

## Do NOT

- Bump package.json version (release operator Phase 6)
