# Task: SP-588 — Extract engine nested-spawn guard

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig split of `src/batch/engine.mjs` per FR-SHIP-02 / #117. nested-spawn guard → batch-guards.mjs.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Extract modules from `src/batch/engine.mjs` into `src/batch/batch-guards.mjs`. Re-export from `engine.mjs` to preserve public API. Remove `src/batch/engine.mjs` from `PHASE23_GRANDFATHERED_OVER_500` in `bin/spine-cli/verify.mjs`. Each resulting file must be ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593 removes all entries after splits land.

## Dependencies

- **Task:** SP-577
- **Task:** SP-603 (wave gate — batch prior second halves landed)

## Context to Read First

- [`spine-tasks/_explore/batch-module-split-v23/findings.md`](../_explore/batch-module-split-v23/findings.md)
- [`src/batch/engine.mjs`](../../src/batch/engine.mjs)
- [`docs/PRD-v2.3.0-module-split-handoff.md`](../../docs/PRD-v2.3.0-module-split-handoff.md) §3 inventory

## File Scope

- `src/batch/engine.mjs`
- `src/batch/batch-guards.mjs`
- `tests/batch/nested-spawn-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/nested-spawn-guard.test.mjs` |
| fileScopeMustChange | `src/batch/engine.mjs`, `src/batch/batch-guards.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for engine.mjs
- [ ] Confirm dependencies satisfied
- [ ] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)

- [ ] Create `src/batch/batch-guards.mjs`
- [ ] Move implementations per handoff: nested-spawn guard → batch-guards.mjs
- [ ] Keep each new file ≤500 LOC

### Step 2: Re-export from engine.mjs

- [ ] Remove moved code from `src/batch/engine.mjs`
- [ ] Re-export public symbols from new module(s)
- [ ] Confirm module ≤500 LOC (grandfather removal deferred to SP-593)

### Step 3: Testing & Verification

- [ ] Run targeted test: `node --test tests/batch/nested-spawn-guard.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify `src/batch/engine.mjs` ≤500 LOC (or removed from grandfather list with justification)

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] New module(s) exist; public API unchanged
- [ ] Module ≤500 LOC (verify.mjs edit deferred to SP-593)
- [ ] All tests passing

## Git Commit Convention

- `refactor(SP-588): split engine.mjs per FR-SHIP-02`

## Do NOT

- Change runtime behavior
- Skip re-exports (breaking importers)
- Edit verify.mjs in this task (use SP-593)
