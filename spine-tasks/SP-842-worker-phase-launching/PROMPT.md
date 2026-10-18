# Task: SP-842 — Worker phase leaves `launching` after the launch script

**Created:** 2026-10-17
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** The phase gates progress-aware stall detection; a wrong phase either disables stall detection (today) or kills healthy workers early.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `src/batch/worker-host.mjs` ~330-366: `let childPastPreflight = isExecute ? true : !useLaunchScript;` is updated by `markChildPastPreflight(workerChild, () => { childPastPreflight = true; })`, but the boolean is passed by value into `pollWorkerUntilSettled({ ..., childPastPreflight, ... })` (~348). `src/batch/worker-heartbeat.mjs` (~131-154, read at ~243) calls `resolveWorkerPhase({ childPastPreflight, useStub, workerBackend })` with the frozen value, and `src/batch/worker-spawn.mjs:257` returns `"launching"` while it is false. With a worker launch script, every heartbeat reports `launching` and progress-aware stall detection stays off.

## Mission

Closes #353 — The heartbeat reads the live preflight state.

1. `pollWorkerUntilSettled` accepts `isPastPreflight: () => boolean` and reads it on every poll: `const pastPreflight = typeof isPastPreflight === "function" ? isPastPreflight() : Boolean(childPastPreflight);` (keep `childPastPreflight` for existing callers). Update the JSDoc (~113).
2. `worker-host.mjs` passes `isPastPreflight: () => childPastPreflight`.
3. Regression test in `tests/batch/heartbeat.test.mjs`: preflight flips to true after the first poll (use `deps.now` / `deps.sleep`); later heartbeats report the post-preflight phase.

## Dependencies

- **None**

## Context to Read First

- GitHub #353
- `src/batch/worker-host.mjs` 320-370
- `src/batch/worker-heartbeat.mjs` 100-260
- `src/batch/worker-spawn.mjs` 245-265
- `tests/batch/heartbeat.test.mjs` 270-450

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/worker-heartbeat.mjs`
- `tests/batch/heartbeat.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/heartbeat.test.mjs tests/batch/contract-stall-override.test.mjs tests/batch/worker-host.test.mjs tests/config/worker-launch-script.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-842` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `src/batch/worker-heartbeat.mjs`, `tests/batch/heartbeat.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `pollWorkerUntilSettled`, `resolveWorkerPhase`

### Step 1: Live preflight state

- [ ] Getter accepted and used per poll; host passes it

**Artifacts:**
- `src/batch/worker-heartbeat.mjs` (modified)
- `src/batch/worker-host.mjs` (modified)

### Step 2: Tests

- [ ] Phase changes after preflight flips mid-poll

**Artifacts:**
- `tests/batch/heartbeat.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-842-worker-phase-launching/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-842`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] Heartbeats leave `launching` once the launch script hands off to pi

## Git Commit Convention

- `fix(SP-842): read live preflight state in worker heartbeat (#353)`

## Do NOT

- Change the dashboard heartbeat display (separate follow-up)
- Change stall timeout values
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
