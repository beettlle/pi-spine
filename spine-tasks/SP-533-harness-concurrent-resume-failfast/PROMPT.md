# Task: SP-533 — Harness concurrent resume failfast

**Created:** 2026-07-07
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Detached resume concurrency fix — second concurrent `resume --force` must fail fast instead of orphaning handoff.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Implement FR-STA-23: a second concurrent `spine batch resume --force` while an engine is already running must **fail fast** with clear diagnosis ([#167](https://github.com/beettlle/pi-spine/issues/167)). Extends SP-434 attached lock to detached concurrent resume without silent orphan terminate.

**Closes:** [#167](https://github.com/beettlle/pi-spine/issues/167)

## Dependencies

- **Task:** SP-434 (attached engine single-owner lock — Done)

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-23, M-HARNESS-03
- [`src/batch/attached-runner.mjs`](../../src/batch/attached-runner.mjs) `enforceAttachedEngineSingleOwner`
- [`src/batch/detached-start.mjs`](../../src/batch/detached-start.mjs) `resumeBatchDetached`
- [`src/batch/resume.mjs`](../../src/batch/resume.mjs)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/detached-start.mjs`
- `src/batch/resume.mjs`
- `tests/batch/resume-concurrent.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/resume-concurrent.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #167 and SP-434 lock behavior when `force: true` handoffs
- [ ] Identify race: two shells spawn `resume --force` concurrently

### Step 1: Fail-fast lock

- [ ] Add concurrent resume guard: when engine PID alive and another resume --force is in-flight, reject with `concurrent_resume_blocked`
- [ ] Use file lock or atomic handoff marker if needed; prefer PID + spawn-in-progress journal event
- [ ] Preserve intentional single handoff when operator explicitly orphans stale engine

### Step 2: Regression tests

- [ ] `tests/batch/resume-concurrent.test.mjs`: second concurrent resume fails; first succeeds

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Comment on #167
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Second concurrent `resume --force` fails with clear error (M-HARNESS-03)
- [ ] No silent dual-engine orphan handoff

## Do NOT

- Remove SP-434 attached single-owner lock
- Break SP-513 paused force-resume reconcile path

## Git Commit Convention

- `fix(SP-533): fail-fast on concurrent resume --force`
