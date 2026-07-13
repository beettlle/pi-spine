# Task: SP-637 — Resume engine limbo diagnose

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Honest diagnosis for post-integrate stuck resume engines; prevent misleading reviews headline.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#198](https://github.com/beettlle/pi-spine/issues/198) (with SP-636)

When tasks are terminal-success, orch is merged, and a resume engine PID is still alive (or `engine_still_running`), diagnose must **not** claim “running reviews — no workers scheduled”. Surface post-integrate limbo / `engine_still_running` with a clear kill/abort/`batch complete` recovery suggestion. Ensure stuck resume engines do not launch a full `npm test` suite against the **main** checkout.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-03

## Dependencies

- **Task:** SP-636 (finalize path available)

## Context to Read First

- `src/batch/diagnosis-tail-state.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/post-merge-limbo.mjs`
- GitHub #198

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis-tail-state.mjs`
- `src/batch/diagnosis.mjs`
- `tests/batch/resume-multi-engine.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-multi-engine.test.mjs` |
| fileScopeMustChange | `src/batch/diagnosis-tail-state.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-636 finalize behavior on disk
- [ ] Reproduce misleading “running reviews” headline for #198 signals

### Step 1: Honest limbo diagnosis

- [ ] When terminal-success + orch merged + engine PID alive → diagnose `engine_still_running` / post-integrate limbo (not reviews)
- [ ] `suggestedCommand` points to safe recovery (kill/abort/complete per existing patterns)
- [ ] Do not spawn full suite on main from stuck resume path

### Step 2: Testing & Verification

- [ ] Add/extend regression for headline + diagnosis code
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

- [ ] Diagnose no longer claims running reviews for #198 limbo
- [ ] #198 closable with SP-636

## Do NOT

- Re-implement finalize (SP-636 owns that)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-637): diagnose post-integrate resume engine limbo (#198)`
