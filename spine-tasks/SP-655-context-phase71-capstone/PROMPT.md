# Task: SP-655 — CONTEXT Phase 71 capstone

**Created:** 2026-07-13
**Size:** S

## Review Level: 0 (None)

**Assessment:** Tracking-only capstone.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Record Phase 71 completion in `spine-tasks/CONTEXT.md`: task table for SP-649–655, link PRD + manifest, mark **v2.6.0 published** (npm/tag already shipped), set **Next Task ID → SP-656**, release note placeholder for v2.7.0, note deferred backlog (#160 Phase C, #135, #127, #124, #120, #43).

**Source:** [`docs/PRD-v2.7.0-operator-ux-evidence-handoff.md`](../../docs/PRD-v2.7.0-operator-ux-evidence-handoff.md) § FR-REL270-07

## Dependencies

- **Task:** SP-649
- **Task:** SP-650
- **Task:** SP-651
- **Task:** SP-652
- **Task:** SP-653
- **Task:** SP-654

## Context to Read First

- `spine-tasks/CONTEXT.md`
- `spine-tasks/_authoring/release-v2.7.0/manifest.md`
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md`

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

### Step 1: Phase 71 CONTEXT update

- [ ] Mark Phase 70 / v2.6.0 published in CONTEXT (clear “pending publish”)
- [ ] Finalize Phase 71 section with SP-649–655 Done rows and exit criteria
- [ ] Set Next Task ID → SP-656; link PRD + manifest
- [ ] Note deferred backlog (#160 Phase C, #135, #127, #124, #120, #43)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 71 capstone

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 71 complete; Next → SP-656
- [ ] v2.6.0 marked published; v2.7.0 release note placeholder present

## Do NOT

- Edit product code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `chore(SP-655): CONTEXT Phase 71 v2.7.0 capstone`
