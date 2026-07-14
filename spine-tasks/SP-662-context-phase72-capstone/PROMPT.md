# Task: SP-662 — CONTEXT Phase 72 capstone

**Created:** 2026-07-13
**Size:** S

## Review Level: 0 (None)

**Assessment:** Tracking-only capstone.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Record Phase 72 completion in `spine-tasks/CONTEXT.md`: task table for SP-656–662, link manifest + post-mortem, mark Phase 72 / SP-REL280 complete once code+runbook land, set **Next Task ID → SP-663**, release note placeholder for v2.8.0, note deferred backlog (#160 Phase C, #135, #127, #124, #120, #43). Do **not** claim v2.8.0 published until operator publish gate.

**Source:** `spine-tasks/_authoring/release-v2.8.0/manifest.md`

## Dependencies

- **Task:** SP-656
- **Task:** SP-657
- **Task:** SP-658
- **Task:** SP-659
- **Task:** SP-660
- **Task:** SP-661

## Context to Read First

- `spine-tasks/CONTEXT.md`
- `spine-tasks/_authoring/release-v2.8.0/manifest.md`
- `docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`

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

### Step 1: Phase 72 CONTEXT update

- [ ] Finalize Phase 72 section with SP-656–662 Done rows and exit criteria
- [ ] Set Next Task ID → SP-663; link manifest + post-mortem
- [ ] Release note placeholder for v2.8.0 (published only after operator bump)
- [ ] Note deferred backlog (#160 Phase C, #135, #127, #124, #120, #43)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `spine-tasks/CONTEXT.md` — Phase 72 capstone

**Check If Affected:**
- None

## Completion Criteria

- [ ] CONTEXT Phase 72 complete; Next → SP-663
- [ ] v2.8.0 release note placeholder present (not false-published)

## Do NOT

- Edit product code
- Claim npm publish / tag without operator approval
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `chore(SP-662): CONTEXT Phase 72 v2.8.0 capstone`
