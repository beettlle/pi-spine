# Task: SP-589 — Extract integrate tryRestoreBranch helper

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Strangler Fig split of `src/batch/integrate.mjs` per FR-SHIP-02 / #117. three identical checkout-recovery try/catch blocks → tryRestoreBranch in integrate-git.mjs.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`.

## Mission

Extract modules from `src/batch/integrate.mjs` into `src/batch/integrate-git.mjs`. Re-export from `integrate.mjs` to preserve public API. Remove `src/batch/integrate.mjs` from `PHASE23_GRANDFATHERED_OVER_500` in `bin/spine-cli/verify.mjs`. Each resulting file must be ≤500 LOC.

**Closes:** #116

## Dependencies

- **Task:** SP-587

## Context to Read First

- [`spine-tasks/_explore/batch-module-split-v23/findings.md`](../_explore/batch-module-split-v23/findings.md)
- [`src/batch/integrate.mjs`](../../src/batch/integrate.mjs)
- [`docs/PRD-v2.3.0-module-split-handoff.md`](../../docs/PRD-v2.3.0-module-split-handoff.md) §3 inventory

## File Scope

- `src/batch/integrate.mjs`
- `bin/spine-cli/verify.mjs`
- `src/batch/integrate-git.mjs`
- `tests/batch/batch-salvage-integrate.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/batch-salvage-integrate.test.mjs` |
| fileScopeMustChange | `src/batch/integrate.mjs`, `bin/spine-cli/verify.mjs`, `src/batch/integrate-git.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for integrate.mjs
- [ ] Confirm dependencies satisfied
- [ ] Identify public exports to preserve via re-export

### Step 1: Create extracted module(s)

- [ ] Create `src/batch/integrate-git.mjs`
- [ ] Move implementations per handoff: three identical checkout-recovery try/catch blocks → tryRestoreBranch in integrate-git.mjs
- [ ] Keep each new file ≤500 LOC

### Step 2: Re-export from integrate.mjs

- [ ] Remove moved code from `src/batch/integrate.mjs`
- [ ] Re-export public symbols from new module(s)
- [ ] Remove `src/batch/integrate.mjs` from `PHASE23_GRANDFATHERED_OVER_500`

### Step 3: Testing & Verification

- [ ] Run targeted test: `node --test tests/batch/batch-salvage-integrate.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify `src/batch/integrate.mjs` ≤500 LOC (or removed from grandfather list with justification)

### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] New module(s) exist; public API unchanged
- [ ] Grandfather entry removed for integrate.mjs
- [ ] All tests passing

## Git Commit Convention

- `refactor(SP-589): split integrate.mjs per FR-SHIP-02`

## Do NOT

- Change runtime behavior
- Skip re-exports (breaking importers)
- Leave module in `PHASE23_GRANDFATHERED_OVER_500` after split
