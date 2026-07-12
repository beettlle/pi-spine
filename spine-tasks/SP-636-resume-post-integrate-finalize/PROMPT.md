# Task: SP-636 — Resume post-integrate finalize

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Ensure resume engine exits / finalizes land loop after merge+gate or host integrate.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Partial:** [#198](https://github.com/beettlle/pi-spine/issues/198)

After merge + gate open (or operator `spine integrate` while a resume engine is still alive), the resume engine must emit `batch.land_loop_finalized` / exit cleanly so `spine batch complete` is not blocked by `engine_still_running`. Do not leave a zombie attached/detached resume process holding the batch.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-02

**Related:** #197, #163, post-merge-limbo

## Dependencies

- **None**

## Context to Read First

- `src/batch/post-merge-limbo.mjs`
- `src/batch/attached-runner-promote.mjs`
- `src/batch/lifecycle.mjs` — `engine_still_running`
- `src/batch/resume.mjs` / detached resume wait paths
- GitHub #198

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/post-merge-limbo.mjs`
- `src/batch/attached-runner-promote.mjs`
- `tests/batch/resume-multi-engine.test.mjs`
- `tests/batch/detached-resume-wait.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-multi-engine.test.mjs tests/batch/detached-resume-wait.test.mjs` |
| fileScopeMustChange | `src/batch/post-merge-limbo.mjs` |

## Steps

### Step 0: Preflight

- [ ] Trace #198: resume --force engine stays alive after host integrate; missing `batch.land_loop_finalized`
- [ ] Identify where finalize should run on resume path vs healthy detached path

### Step 1: Finalize / exit resume engine

- [ ] After merge+gate ready (or integrate completed), resume engine writes `batch.land_loop_finalized` (or equivalent) and exits
- [ ] Host `spine batch complete` is not blocked by a live resume PID in the happy path after finalize
- [ ] Do not require hand-editing batch-state

### Step 2: Testing & Verification

- [ ] Add/extend regression for resume finalize after merge/gate
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641 owns operator docs

## Completion Criteria

- [ ] Resume path emits land-loop finalize / exits after merge+gate
- [ ] Regression covers finalize presence

## Do NOT

- Redesign diagnose headlines (SP-637)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-636): finalize resume engine after merge/gate (#198)`
