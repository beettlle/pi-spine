# Task: SP-645 — Diagnose salvage pending lane

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Diagnosis alternatives for state_drift pending land; follows SP-644 refuse gate.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

**Closes:** [#201](https://github.com/beettlle/pi-spine/issues/201) (with SP-644)

When diagnose sees `state_drift` (or terminal-success) with `doneInLane=true`, `doneOnMain=false`, and pending lane commits / orch merge no-op, **suggestedCommand** (and alternatives) must recommend `spine batch salvage --batch <id> --lane <n> --integrate` (or current salvage CLI shape) instead of `spine batch complete`. Align headline with pending-land, not “ready to archive”.

## Dependencies

- **Task:** SP-644 (complete refuse must land first — same failure class)

## Context to Read First

- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-alternatives.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `src/batch/salvage-batch-list.mjs`
- GitHub #201
- SP-644 PROMPT

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-alternatives.mjs`
- `src/batch/reconcile-diagnosis.mjs`
- `tests/batch/diagnosis-salvage-pending-lane.test.mjs` (or extend existing diagnosis test)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/diagnosis-salvage-pending-lane.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis-alternatives.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-644 refuse behavior on disk
- [ ] Map current salvage CLI flags from code/docs

### Step 1: Salvage suggestion for pending land

- [ ] Detect pending-land signals in diagnosis path
- [ ] Primary suggestedCommand → salvage integrate (correct flags)
- [ ] Do not recommend `batch complete` as primary for this class

### Step 2: Testing & Verification

- [ ] Regression for suggestedCommand / alternatives
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-641)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641

## Completion Criteria

- [ ] #201 closable with SP-644
- [ ] Diagnose points at salvage, not complete, for pending land

## Do NOT

- Re-open completeBatch logic beyond reading SP-644 behavior
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-645): diagnose suggests salvage for pending lane land (#201)`
