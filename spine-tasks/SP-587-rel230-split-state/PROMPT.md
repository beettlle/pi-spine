# Task: SP-587 — Split state.mjs

**Created:** 2026-07-10
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig split of `src/batch/state.mjs` per FR-SHIP-02 / #117. read/write/archive → state-io; write guard + PID + schema → state-guards.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Extract modules from `src/batch/state.mjs` into `src/batch/state-io.mjs`, `src/batch/state-guards.mjs`. Re-export from `state.mjs` to preserve public API. Remove `src/batch/state.mjs` from `PHASE23_GRANDFATHERED_OVER_500` in `bin/spine-cli/verify.mjs`. Each resulting file must be ≤500 LOC.

**Closes:** partial #117

## Dependencies

- **Task:** SP-578

## Context to Read First

- [`spine-tasks/_explore/batch-module-split-v23/findings.md`](../_explore/batch-module-split-v23/findings.md)
- [`src/batch/state.mjs`](../../src/batch/state.mjs)
- [`docs/PRD-v2.3.0-module-split-handoff.md`](../../docs/PRD-v2.3.0-module-split-handoff.md) §3 inventory

## File Scope

- `src/batch/state.mjs`
- `bin/spine-cli/verify.mjs`
- `src/batch/state-io.mjs`
- `src/batch/state-guards.mjs`
- `tests/batch/reconcile.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/reconcile.test.mjs` |
| fileScopeMustChange | `src/batch/state.mjs`, `bin/spine-cli/verify.mjs`, `src/batch/state-io.mjs`, `src/batch/state-guards.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for state.mjs
- [ ] Confirm dependencies satisfied
- [ ] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)

- [ ] Create `src/batch/state-io.mjs` and `src/batch/state-guards.mjs`
- [ ] Move implementations per handoff: read/write/archive → state-io; write guard + PID + schema → state-guards
- [ ] Keep each new file ≤500 LOC

### Step 2: Re-export from state.mjs

- [ ] Remove moved code from `src/batch/state.mjs`
- [ ] Re-export public symbols from new module(s)
- [ ] Remove `src/batch/state.mjs` from `PHASE23_GRANDFATHERED_OVER_500`

### Step 3: Testing & Verification

- [ ] Run targeted test: `node --test tests/batch/reconcile.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify `src/batch/state.mjs` ≤500 LOC (or removed from grandfather list with justification)

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] New module(s) exist; public API unchanged
- [ ] Grandfather entry removed for state.mjs
- [ ] All tests passing

## Git Commit Convention

- `refactor(SP-587): split state.mjs per FR-SHIP-02`

## Do NOT

- Change runtime behavior
- Skip re-exports (breaking importers)
- Leave module in `PHASE23_GRANDFATHERED_OVER_500` after split
