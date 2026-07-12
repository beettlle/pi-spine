# Task: SP-630 — Stamp category on gate open

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Touches gate open after revision work; no auto-approve.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Partial #123 — On `openIntegrateGate`, stamp `category` on the gate record (default integrate → category whose posture is **locked** until config opts in). Do not auto-approve in this task.

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-08

## Dependencies

- **Task:** SP-624 (serialize gate.mjs after revision validate)
- **Task:** SP-626 (serialize gate.mjs after blocker wire)
- **Task:** SP-627 (categories)

## Context to Read First

- `src/batch/gate.mjs`
- `src/batch/gate-posture-defaults.mjs`
- `src/config/gate-posture-config.mjs` (if present from SP-629 — optional read)
- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate.mjs`
- `tests/batch/gate-posture-stamp.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-stamp.test.mjs` |
| fileScopeMustChange | `src/batch/gate.mjs`, `tests/batch/gate-posture-stamp.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Stamp category on open

- [ ] Set `gate.category` on open using defaults/config mapping
- [ ] Default remains locked posture (no auto-approve side effect)
- [ ] Unit test asserts category present and status still pending

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

- [ ] Gate records include category; still pending/manual by default

## Do NOT

- Auto-approve gates
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-630): stamp gate category on open`

