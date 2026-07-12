# Task: SP-625 — BlockerCode types module

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** New pure module; no wiring.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #122 — Add `src/batch/blocker-codes.mjs` with an allow-listed `BlockerCode` set and `{ code, message }` helper for readiness/gate blockers. Include codes for missing gate, pending, rejected, stale revision, and related integrate readiness cases from explore/PRD.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-03

## Dependencies

- **None**

## Context to Read First

- `src/batch/gate.mjs` — current free-text errors
- GitHub [#122](https://github.com/beettlle/pi-spine/issues/122)
- `spine-tasks/_explore/v2.5-gate-maturity/findings.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/blocker-codes.mjs`
- `tests/batch/blocker-codes.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/blocker-codes.test.mjs` |
| fileScopeMustChange | `src/batch/blocker-codes.mjs`, `tests/batch/blocker-codes.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Define codes + helper

- [ ] Export BlockerCode allow-list and `makeBlocker(code, message)` (or equivalent)
- [ ] Reject unknown codes fail-closed in helper
- [ ] Unit tests for happy path + unknown code

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

- [ ] Pure module exports usable by SP-626
- [ ] No gate.mjs wiring in this task

## Do NOT

- Wire into gate.mjs (SP-626)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-625): add BlockerCode types module`

