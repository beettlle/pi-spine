# Task: SP-618 — CONTEXT Phase 67 capstone

**Created:** 2026-07-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync for v2.3.2 state-drift recovery epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 67 table (v2.3.2 state-drift recovery) with landed status for SP-613–617. Verify `dependencies.json` edges. Set **Next Task ID → SP-619**. Link release manifest and PRD exit criteria.

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md)

## Dependencies

- **Task:** SP-613
- **Task:** SP-614
- **Task:** SP-615
- **Task:** SP-616
- **Task:** SP-617

## Context to Read First

- [`spine-tasks/CONTEXT.md`](../CONTEXT.md)
- [`spine-tasks/_authoring/release-v2.3.2/manifest.md`](../_authoring/release-v2.3.2/manifest.md)
- [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-613 SP-614 SP-615 SP-616 SP-617 SP-618` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-613–617 `.DONE` on main

### Step 1: CONTEXT Phase 67

- [ ] Add/update Phase 67 table with Done status for SP-613–617
- [ ] Update PRD §9 exit criteria checkboxes in CONTEXT notes as appropriate
- [ ] Set Next Task ID: SP-619
- [ ] Link PRD and `spine-tasks/_authoring/release-v2.3.2/manifest.md`

### Step 2: dependencies.json

- [ ] Verify SP-613–618 edges present and correct

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-613 SP-614 SP-615 SP-616 SP-617 SP-618`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 67 table + Next Task ID

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 67 complete; Next Task ID → SP-619
- [ ] PRD exit criteria reflected in CONTEXT
- [ ] dependencies.json edges verified

## Do NOT

- Author Phase 68 / next-minor enhancement tasks beyond tracking notes
- Modify `src/**` or `bin/**`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `chore(SP-618): CONTEXT Phase 67 v2.3.2 capstone`
