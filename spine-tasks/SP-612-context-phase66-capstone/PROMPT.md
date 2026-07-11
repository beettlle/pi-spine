# Task: SP-612 — CONTEXT Phase 66 capstone

**Created:** 2026-07-10
**Size:** S

## Review Level: 0 (None)

**Assessment:** CONTEXT.md + dependencies.json sync for v2.3.1 reliability epic.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Update `spine-tasks/CONTEXT.md` Phase 66 table (v2.3.1 reliability) with landed status for SP-608–611. Verify `dependencies.json` edges. Set **Next Task ID → SP-613**. Link release manifest and PRD exit criteria.

**Source:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md)

## Dependencies

- **Task:** SP-608
- **Task:** SP-609
- **Task:** SP-610
- **Task:** SP-611

## Context to Read First

- [`spine-tasks/CONTEXT.md`](../CONTEXT.md)
- [`spine-tasks/_authoring/release-v2.3.1/manifest.md`](../_authoring/release-v2.3.1/manifest.md)
- [`docs/PRD-v2.3.1-reliability-handoff.md`](../../docs/PRD-v2.3.1-reliability-handoff.md)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`
- `spine-tasks/dependencies.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node bin/spine.mjs tasks validate SP-608 SP-609 SP-610 SP-611 SP-612` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-608–611 `.DONE` on main

### Step 1: CONTEXT Phase 66

- [ ] Add/update Phase 66 table with Done status for SP-608–611
- [ ] Update PRD §9 exit criteria checkboxes in CONTEXT notes as appropriate
- [ ] Set Next Task ID: SP-613
- [ ] Link PRD and `spine-tasks/_authoring/release-v2.3.1/manifest.md`

### Step 2: dependencies.json

- [ ] Verify SP-608–612 edges present and correct

### Step 3: Testing & Verification

- [ ] `spine tasks validate SP-608 SP-609 SP-610 SP-611 SP-612`

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 66 table + Next Task ID

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 66 complete; Next Task ID → SP-613
- [ ] PRD exit criteria reflected in CONTEXT
- [ ] dependencies.json edges verified

## Do NOT

- Author Phase 67 / next-minor enhancement tasks
- Modify `src/**` or `bin/**`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `chore(SP-612): CONTEXT Phase 66 v2.3.1 capstone`
