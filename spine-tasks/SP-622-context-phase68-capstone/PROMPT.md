# Task: SP-622 — CONTEXT Phase 68 capstone

**Created:** 2026-07-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync for v2.4.0 recovery continuity epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 68 table (v2.4.0 recovery continuity / batch-meta) with landed status for SP-602, SP-605, SP-619–621. Verify `dependencies.json` edges. Set **Next Task ID → SP-623**. Link release manifest and PRD exit criteria.

**Source:** [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md)

## Dependencies

- **Task:** SP-602
- **Task:** SP-605
- **Task:** SP-619
- **Task:** SP-620
- **Task:** SP-621

## Context to Read First

- [`spine-tasks/CONTEXT.md`](../CONTEXT.md)
- [`spine-tasks/_authoring/release-v2.4.0/manifest.md`](../_authoring/release-v2.4.0/manifest.md)
- [`docs/PRD-v2.4.0-recovery-batch-meta-handoff.md`](../../docs/PRD-v2.4.0-recovery-batch-meta-handoff.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-602 SP-605 SP-619 SP-620 SP-621 SP-622` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-602, SP-605, SP-619–621 `.DONE` on main

### Step 1: CONTEXT Phase 68

- [ ] Add/update Phase 68 table with Done status for SP-602, SP-605, SP-619–621
- [ ] Update PRD §9 exit criteria checkboxes in CONTEXT notes as appropriate
- [ ] Set Next Task ID: SP-623
- [ ] Link PRD and `spine-tasks/_authoring/release-v2.4.0/manifest.md`

### Step 2: dependencies.json

- [ ] Verify SP-602, SP-605, SP-619–622 edges present and correct

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-602 SP-605 SP-619 SP-620 SP-621 SP-622`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 68 table + Next Task ID

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 68 complete; Next Task ID → SP-623
- [ ] PRD exit criteria reflected in CONTEXT
- [ ] dependencies.json edges verified

## Do NOT

- Author Phase 69 / next-release enhancement tasks beyond tracking notes
- Modify `src/**` or `bin/**`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `chore(SP-622): CONTEXT Phase 68 v2.4.0 capstone`
