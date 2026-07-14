# Task: SP-660 — Single resume owner

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Strengthen #167 concurrent resume fail-fast for paired detached+attached `resume_handoff_started`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#207](https://github.com/beettlle/pi-spine/issues/207)

v2.7.0 recovery logged **8** `batch.resume_handoff_started` events, typically **paired** (detached + attached) for the same recover/retry; leftover resume PIDs needed `kill -9` after `batch complete`. Related to #167 / #89 — strengthen **single resume owner**: fail-fast if a second `resume --force` starts while lock/engine is alive (extend `tryAcquireResumeHandoffLock` / `enforceAttachedEngineSingleOwner` so agent shells cannot spawn a dual engine).

**Source:** [`docs/release/post-mortem-v2.7.0-batch-20260713T171709.md`](../../docs/release/post-mortem-v2.7.0-batch-20260713T171709.md) §7 P0.5 / §F4

## Dependencies

- **None**

## Context to Read First

- GitHub issue #207
- Closed #167 / SP-533 (`tests/batch/resume-concurrent.test.mjs`)
- `src/batch/attached-runner.mjs` (handoff lock exports)
- `src/batch/detached-start.mjs` / `src/batch/detached-run.mjs`
- `src/batch/resume.mjs`
- Post-mortem §F4

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/resume.mjs`
- `tests/batch/resume-concurrent.test.mjs`
- `tests/batch/resume-single-owner.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/resume-concurrent.test.mjs tests/batch/resume-single-owner.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner.mjs`, `tests/batch/resume-single-owner.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-533 concurrent lock tests and remaining gaps for detached+attached pairing
- [ ] Trace where `batch.resume_handoff_started` is appended for detached vs attached

### Step 1: Fail-fast second resume

- [ ] Ensure second `resume --force` (attached or detached) fails fast while handoff lock / live engine owns the batch
- [ ] Clear operator-facing error; no dual engines; no silent second handoff journal pair
- [ ] Extend/add tests covering paired detached-then-attached (or reverse) attempt

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Close GitHub issue #207 (`gh issue close 207`) when criteria met

## Documentation Requirements

**Must Update:**
- None (narrative in SP-661)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-661

## Completion Criteria

- [ ] Second resume while lock/engine alive fails fast
- [ ] #207 closable
- [ ] Scoped tests green

## Do NOT

- Background `--attached` resume (#163 still forbidden in agent shells)
- Change dirty-check or orphan heal packets
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-660): fail-fast second resume while engine owns batch (#207)`
