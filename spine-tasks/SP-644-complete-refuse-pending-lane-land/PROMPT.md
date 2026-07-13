# Task: SP-644 — Complete refuse pending lane land

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Gate `completeBatch` when lane work is not on main; touches land-loop caller path.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

> **GitNexus:** `completeBatch` upstream impact is **HIGH** (sequence land loop, `runBatchComplete`). Keep change additive fail-closed; do not widen archive success paths.

## Mission

**Partial:** [#201](https://github.com/beettlle/pi-spine/issues/201)

`spine batch complete` must **refuse** to archive when any task has `doneInLane=true` (or lane branch ahead of base) and `doneOnMain=false`. Today `allTasksTerminalSuccess` + `orchMergedToBase` can allow complete while lane commits never landed (dogfood / skipjack salvage). Suggested command must point at salvage integrate or status diagnose — not a successful archive.

## Dependencies

- **None**

## Context to Read First

- `src/batch/lifecycle.mjs` — `completeBatch`
- `src/batch/diagnosis-task-done.mjs` — `doneOnMain` / `doneInLane`
- `src/batch/salvage-batch-list.mjs` — salvage signals
- `tests/batch/` — existing complete / lifecycle tests
- GitHub #201

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lifecycle.mjs`
- `tests/batch/batch-complete-engine.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-complete-engine.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #201 allow path in unit terms (terminal success + orchMerged + doneInLane && !doneOnMain)
- [ ] Confirm GitNexus HIGH callers stay compatible

### Step 1: Refuse complete when pending lane land

- [ ] In `completeBatch`, refuse when any reconciled task is `doneInLane && !doneOnMain` (or equivalent lane-ahead signal)
- [ ] Clear error + `suggestedCommand` toward salvage / diagnose (not archive success)
- [ ] Do not break legitimate `completed` / manual-merge complete paths where `doneOnMain` is true

### Step 2: Testing & Verification

- [ ] Add regression for refuse path
- [ ] Run contract `testCommand` only (scoped) — no full suite / coverage in-lane
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-641 owns runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641

## Completion Criteria

- [ ] `completeBatch` refuses #201 pending-land case
- [ ] Regression covers refuse + suggestedCommand

## Do NOT

- Implement diagnose salvage wording (SP-645)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-644): refuse batch complete when lane not on main (#201)`
