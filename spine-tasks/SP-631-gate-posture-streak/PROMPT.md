# Task: SP-631 — Approval streak counters for after-N

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** New persistence for consecutive approvals.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Partial #123 — Persist consecutive approval streak counters used by `autoApproveAfterN` (per category or per gate kind). Reset on reject / manual break as covered by tests. No full approve wiring yet (SP-632 consumes this).

**Source:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../docs/PRD-v2.5.0-gate-maturity-handoff.md) §6 FR-REL250-09

## Dependencies

- **Task:** SP-629 (thresholds from config)

## Context to Read First

- `src/config/gate-posture-config.mjs`
- `src/fs/atomic-write.mjs`
- GitHub [#123](https://github.com/beettlle/pi-spine/issues/123)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/gate-posture-streak.mjs`
- `tests/batch/gate-posture-streak.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/gate-posture-streak.test.mjs` |
| fileScopeMustChange | `src/batch/gate-posture-streak.mjs`, `tests/batch/gate-posture-streak.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: Streak store API

- [ ] Implement load/increment/reset helpers with atomic writes under runtime path
- [ ] Unit tests for increment, reset, and threshold read

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

- [ ] Streak API ready for SP-632

## Do NOT

- Wire auto-approve into land-loop
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-631): add gate posture approval streak counters`

