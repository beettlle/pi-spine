# Task: SP-613 — Drift detached recover

**Created:** 2026-07-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Fix agent-safe detached resume/reconcile when state_drift leaves phase=running with a dead engine.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Partial #196 — When diagnosis is `state_drift`, the engine PID is dead, `phase=running`, and lane evidence shows terminal-success / `doneInLane`, provide an **agent-safe detached** recovery path that reconciles toward `needs_integrate` / open gate. Detached `resume --force` must not dead-end on `Cannot resume batch in phase running`; `suggestedCommand` must not require `--attached` under #163 non-TTY shells.

**Source:** [`docs/PRD-v2.3.2-state-drift-recovery-handoff.md`](../../docs/PRD-v2.3.2-state-drift-recovery-handoff.md) §6 FR-REL232-01

**Related:** #163 / #185 (prefer detached), #170 / #184 (prior drift/orphan recoveries)

## Dependencies

- **None**

## Context to Read First

- [`src/batch/detached-run.mjs`](../../src/batch/detached-run.mjs) — `resumeBatchDetached`
- [`src/batch/resume.mjs`](../../src/batch/resume.mjs) / multi-validate — phase=running gates
- [`src/batch/diagnosis.mjs`](../../src/batch/diagnosis.mjs) — `buildSuggestedCommand` state_drift branch
- [`tests/batch/engine-orphan-resume.test.mjs`](../../tests/batch/engine-orphan-resume.test.mjs)
- [`tests/batch/resume-orphan-recovery.test.mjs`](../../tests/batch/resume-orphan-recovery.test.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/detached-run.mjs`
- `src/batch/resume.mjs`
- `src/batch/resume-multi-validate.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/engine-orphan-resume.test.mjs`
- `tests/batch/resume-orphan-recovery.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/engine-orphan-resume.test.mjs tests/batch/resume-orphan-recovery.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #196 path: dead enginePid + phase=running + doneInLane + state_drift
- [ ] Trace why detached resume rejects `phase running` and what diagnose suggests

### Step 1: Detached reconcile / resume path

- [ ] When engine is dead and tasks are terminal-success with lane `.DONE`, detached resume/--force reconciles to gate-ready / `needs_integrate` (or clear stuck running cache)
- [ ] Do not require `--attached` for this recovery
- [ ] Update `buildSuggestedCommand` for state_drift so agent shells get a working detached command

### Step 2: Testing & Verification

- [ ] Add/extend regression: dead engine + phase running + doneInLane recovers without attached
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-617 owns the full recovery section

## Completion Criteria

- [ ] Agent-shell detached recovery works for the #196 dead-engine drift case
- [ ] suggestedCommand does not point at refused `--attached` for that case
- [ ] Regression tests cover the scenario

## Do NOT

- Expand into salvage list/integrate (SP-614) or abort dry-run (SP-615)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-613): agent-safe detached state_drift recovery`
