# Task: SP-635 — Resume eligibility terminal class

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Align force-resume eligibility with diagnose classification; single-module fix.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#197](https://github.com/beettlle/pi-spine/issues/197)

When diagnose reports `state_drift` with terminal-success / `doneInLane` but batch-state `status` is still `running`, detached `spine batch resume --force` must succeed without requiring a manual `pause` first. Fix `allTasksTerminalSuccessForResume` / running-phase eligibility so classification (or healed status) matches diagnose — not raw `status === "succeeded"` only.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-01

**Related:** #196 / SP-613 agent-safe drift recovery

## Dependencies

- **None**

## Context to Read First

- `src/batch/resume-multi-validate.mjs` — `allTasksTerminalSuccessForResume`, `assessRunningPhaseResumeEligibility`
- `src/batch/diagnosis.mjs` — state_drift suggestedCommand
- `tests/batch/resume-multi-validation.test.mjs`
- `tests/batch/engine-orphan-resume.test.mjs`
- GitHub #197

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-multi-validate.mjs`
- `tests/batch/resume-multi-validation.test.mjs`
- `tests/batch/engine-orphan-resume.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-multi-validation.test.mjs tests/batch/engine-orphan-resume.test.mjs` |
| fileScopeMustChange | `src/batch/resume-multi-validate.mjs`, `tests/batch/resume-multi-validation.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #197: terminal-success classification + status=running + pidless engine → resume --force rejected until pause
- [ ] Trace `allTasksTerminalSuccessForResume` vs diagnose classification

### Step 1: Align eligibility with terminal classification

- [ ] Treat terminal-success / skipped (classification or healed status) as success for force-resume eligibility
- [ ] Detached `resume --force` progresses without requiring pause for the #197 scenario
- [ ] Do not weaken fail-closed for truly running workers

### Step 2: Testing & Verification

- [ ] Add/extend regression covering #197 path
- [ ] Run contract `testCommand`
- [ ] Run contract `testCommand` only (scoped) — do **not** run full `npm test` or `npm run coverage:check` in the lane (parallel waves overload the host; integrate / `npm run release:check` owns full suite + coverage)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641 owns operator docs

## Completion Criteria

- [ ] `resume --force` works for #197 without prior pause
- [ ] Regression test covers status=running + terminal-success classification

## Do NOT

- Implement post-integrate finalize (SP-636) or limbo diagnose (SP-637)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-635): align resume eligibility with terminal classification (#197)`
