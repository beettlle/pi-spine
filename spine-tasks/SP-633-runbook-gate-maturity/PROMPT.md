# Task: SP-633 — Runbook gate maturity

**Created:** 2026-07-12
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only after code paths land.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Document operator-facing gate maturity for v2.5.0: targetRevision stale-approval behavior (#121), structured blocker codes (#122), and category postures with **locked defaults** (#123). Cross-link sequence auto-approve safety and detachment rules (#163/#185).

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-11

## Dependencies

- **Task:** SP-624
- **Task:** SP-626
- **Task:** SP-632

## Context to Read First

- `docs/adoption/operator-runbook.md`
- GitHub #121 #122 #123

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Add gate maturity section

- [ ] Document revision pin + re-approve on drift
- [ ] Document blocker codes for automation consumers
- [ ] Document postures table + locked default + how to opt in safely

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (docs-only; no coverage gate required)
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gate maturity (revision, blockers, postures)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Runbook covers #121/#122/#123 operator paths

## Do NOT

- Change engine/CLI code
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `docs(SP-633): runbook gate maturity for v2.5.0`

