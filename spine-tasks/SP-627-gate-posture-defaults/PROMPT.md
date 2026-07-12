# Task: SP-627 — DEFAULT_POSTURES categories table

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure data module for categories/postures.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Partial #123 — Add `src/batch/gate-posture-defaults.mjs` with categories (read, write, execute, destroy, network, auth) and `DEFAULT_POSTURES` (destroy/auth locked; others documented defaults). No I/O or auto-approve wiring.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-05

## Dependencies

- **None**

## Context to Read First

- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)
- `spine-tasks/_explore/v2.5-gate-maturity/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate-posture-defaults.mjs`
- `tests/batch/gate-posture-defaults.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-defaults.test.mjs` |
| fileScopeMustChange | `src/batch/gate-posture-defaults.mjs`, `tests/batch/gate-posture-defaults.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Export defaults table

- [ ] Define categories + posture enums/constants
- [ ] DEFAULT_POSTURES with destroy/auth locked
- [ ] Unit test table shape and locked invariants

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] Defaults module ready for evaluator/config tasks

## Do NOT

- Wire auto-approve
- Edit gate.mjs
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-627): add DEFAULT_POSTURES categories table`

