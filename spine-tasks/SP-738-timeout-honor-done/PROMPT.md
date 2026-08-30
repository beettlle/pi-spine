# Task: SP-738 — Honor .DONE before classifying worker timeout failure

**Created:** 2026-08-30
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Exit classification false-positive destroys completed lane work; small surface, high operator impact.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Closes #273 — At worker runner exit / timeout boundary, if `.DONE` exists in the lane task folder (and/or doneInLane commits show completion), do not classify the task as timeout-`failed`. Honor post-done grace (`DEFAULT_POST_DONE_GRACE_MIN` / config) and treat the task as successfully done so review/contract can proceed.

## Dependencies

- **Task:** SP-737

## Context to Read First

- GitHub #273 — timeout after all steps + `.DONE` still → failed
- `src/batch/worker-heartbeat.mjs` — exit / timeout classification
- `src/batch/heartbeat.mjs` — `DEFAULT_POST_DONE_GRACE_MIN`
- `tests/batch/worker-post-done-grace.test.mjs`
- Parent: SP-737 — stall signal fixes land first (shared heartbeat modules)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-heartbeat.mjs`
- `src/batch/heartbeat.mjs`
- `tests/batch/worker-post-done-grace.test.mjs`
- `tests/batch/worker-timeout-heartbeat-slide.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-post-done-grace.test.mjs tests/batch/worker-timeout-heartbeat-slide.test.mjs tests/batch/post-done-orphan-heal.test.mjs` |
| fileScopeMustChange | `src/batch/worker-heartbeat.mjs`, `tests/batch/worker-post-done-grace.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-737 `.DONE` on main
- [ ] Trace timeout → `task.failed` path when `.DONE` already on disk

### Step 1: Done-before-timeout classification

- [ ] On timeout/exit, check lane `.DONE` (and doneInLane if already available) before failing
- [ ] Apply post-done grace; do not fail a completed worker for wall-clock budget alone

### Step 2: Regression tests

- [ ] Simulate timeout with `.DONE` present → success / not timeout-failed
- [ ] Keep true stall/timeout without `.DONE` as failure

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] None required
- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- None required

## Completion Criteria

- [ ] Timeout with `.DONE` does not mark task failed
- [ ] Post-done grace still reap/cleanup as designed
- [ ] Regression tests pass
- [ ] Closes #273
- [ ] `.DONE` created

## Do NOT

- Weaken stall killing for workers without `.DONE` (#272)
- Change salvage integrate gate opening (#274)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-738): honor .DONE before worker timeout failure (#273)`
