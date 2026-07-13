# Task: SP-647 — Orphan retry abort limbo clear

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Make retry/abort clear multi-lane dead-engine limbo without runtime surgery.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#203](https://github.com/beettlle/pi-spine/issues/203) (with SP-646)

Given SP-646 classification, `spine batch retry <taskId>` and/or `spine batch abort` must restore consistent lane/runtime state when the engine PID is dead and workers are stale — **without** hand-editing `.spine/runtime/**` or `batch-state.json`. Add regression coverage (or fixture-level) for multi-lane orphan recovery.

## Dependencies

- **Task:** SP-646 (classification + suggestedCommand first)

## Context to Read First

- `src/batch/retry.mjs` (or current retry entry)
- `src/batch/lifecycle.mjs` — abort/dismiss
- `src/batch/resume.mjs` / `resume-multi-validate.mjs`
- SP-646 PROMPT + GitHub #203

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/retry.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/resume-multi-validate.mjs`
- `tests/batch/orphan-retry-limbo.test.mjs` (or extend orphan/retry tests)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/orphan-retry-limbo.test.mjs` |
| fileScopeMustChange | `src/batch/retry.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-646 diagnosis + suggestedCommand on disk
- [ ] Trace why retry was blocked under phase=running with dead engine

### Step 1: Clear limbo via retry/abort

- [ ] Retry (or abort per diagnose) succeeds when engine dead + orphan classified
- [ ] No requirement to hand-edit `.spine/runtime/**`
- [ ] Fail-closed when workers are truly alive

### Step 2: Testing & Verification

- [ ] Regression for multi-lane dead-engine recovery
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

- [ ] #203 closable with SP-646
- [ ] Retry/abort clears limbo without runtime surgery

## Do NOT

- Hand-edit runtime in tests as the “fix”
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-647): clear dead-engine orphan limbo via retry/abort (#203)`
