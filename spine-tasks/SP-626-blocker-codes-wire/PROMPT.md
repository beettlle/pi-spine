# Task: SP-626 — Wire structured blockers into gate checks

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Touches gate check returns; keep string headlines.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #122 — Emit structured `{ code, message }` blockers from `checkIntegrateGate` (and related approve/status returns where natural). Keep human-readable `error`/`headline` strings for CLI. Backward compatible for consumers that ignore `blockers`.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-04

## Dependencies

- **Task:** SP-625 (blocker module)
- **Task:** SP-624 (serialize `gate.mjs` after revision validate)

## Context to Read First

- `src/batch/blocker-codes.mjs`
- `src/batch/gate.mjs`
- GitHub [#122](https://github.com/beettlle/pi-spine/issues/122)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate.mjs`
- `src/batch/blocker-codes.mjs`
- `tests/batch/blocker-codes-wire.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/blocker-codes-wire.test.mjs` |
| fileScopeMustChange | `src/batch/gate.mjs`, `tests/batch/blocker-codes-wire.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Wire blockers on blocked paths

- [ ] Attach `blockers` array (or single blocker) on fail-closed gate check paths
- [ ] Include stale-revision code when SP-624 drift path fires
- [ ] Tests assert codes without breaking headline strings

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
- `docs/adoption/operator-runbook.md` — SP-633

## Completion Criteria

- [ ] Blocked integrate paths expose structured codes
- [ ] Closes #122

## Do NOT

- Implement postures (SP-627+)
- Remove human-readable headlines
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-626): wire structured blockers into gate checks`

