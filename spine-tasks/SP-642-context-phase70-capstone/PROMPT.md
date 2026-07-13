# Task: SP-642 — CONTEXT Phase 70 capstone

**Created:** 2026-07-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Tracking-only capstone.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Record Phase 70 completion in `spine-tasks/CONTEXT.md`: task table for SP-635–648, link PRD + manifest, release note placeholder for v2.6.0, set **Next Task ID → SP-649**, note deferred backlog (#202, #160 B/C, #135, #127, #124, #120, #43).

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-08

## Dependencies

- **Task:** SP-635
- **Task:** SP-636
- **Task:** SP-637
- **Task:** SP-638
- **Task:** SP-639
- **Task:** SP-640
- **Task:** SP-641
- **Task:** SP-643
- **Task:** SP-644
- **Task:** SP-645
- **Task:** SP-646
- **Task:** SP-647
- **Task:** SP-648

## Context to Read First

- `spine-tasks/CONTEXT.md`
- `spine-tasks/_authoring/release-v2.6.0/manifest.md`
- `docs/PRD-v2.6.0-consumer-resume-handoff.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `spine-tasks/CONTEXT.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Phase 70 CONTEXT update

- [ ] Add Phase 70 section with SP-635–648 rows and exit criteria checkboxes
- [ ] Set Next Task ID → SP-649; link PRD + manifest
- [ ] Note deferred backlog (#202, #160 B/C, #135, #127, #124, #120, #43)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 70 capstone

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 70 complete; Next → SP-644

## Do NOT

- Edit product code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `chore(SP-642): CONTEXT Phase 70 v2.6.0 capstone`
