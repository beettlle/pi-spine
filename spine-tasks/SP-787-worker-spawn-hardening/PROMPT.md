# Task: SP-787 — Worker spawn hardening

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every lane's worker goes through `worker-spawn.mjs`; a spawn failure currently crashes the engine and loses every lane. Also a shell-injection fix.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 2, Reversibility: 0
**Problem theory:** Worker child processes have no `error` listener, so EACCES/EAGAIN/EMFILE or a missing `process.execPath` raises an unhandled `'error'` event and kills the engine. `collectChildOutput` appends stdout/stderr to strings for the worker's whole life although only a tail is ever used. `appendWorkerLiveLogChunk` re-reads and atomically rewrites the whole live log on every chunk. The execution-only path interpolates the task folder into a `/bin/sh -c` string, so `"`, `$(`, or a backtick in the path runs as shell code.

## Mission

Closes #306 (with SP-788) — A worker spawn failure yields `launch_failed` for that lane while the engine keeps running; worker output memory is bounded; live logging is append-only; the `.DONE` path is never shell-interpolated.

1. **Spawn error → `launch_failed`** (`src/batch/worker-spawn.mjs` `collectChildOutput`): attach `child.once("error", …)` that resolves `{ exitCode: 127, output: <tail> + String(err), spawnError: true }` (resolve once — guard against a later `close`). In `src/batch/worker-host.mjs`, when the settled result has `spawnError: true`, classify the lane `launch_failed` through the existing `buildWorkerFailureResult` path. Confirm `pollWorkerUntilSettled` exits its loop when the spawn failed (`exitCode` stays `null` on a failed spawn — race or flag as needed without editing `worker-heartbeat.mjs`; if that proves impossible, log under Blockers).
2. **Bounded output** — replace string accumulation in `collectChildOutput` with a bounded tail buffer sized by `resolveWorkerOutputConfig(config).maxBytes` (thread `config` in, or pass the byte cap). Combined output keeps the last N bytes; order stdout-then-stderr as today.
3. **Append-only live log** (`src/batch/worker-output.mjs` `appendWorkerLiveLogChunk`): `fs.appendFileSync` the redacted chunk; only when the file exceeds **twice** `workerLiveLogMaxBytes`, truncate it back to the cap (keep the tail). No per-chunk full read. `worker-output.mjs` is at 492 lines — stay ≤ 500 (extract a helper module under `src/batch/` if needed and add it to STATUS Discoveries).
4. **No shell interpolation** (`spawnExecutionOnlyHandle`): pass the `.DONE` path as a positional argument — `spawn("/bin/sh", ["-c", `${command} && touch "$1"`, "sh", donePath], …)`.
5. **Tests** in a new file: a non-executable launch script (EACCES) yields `launch_failed` and the test process survives (no unhandled `'error'`); a worker printing well over the cap keeps the collected string bounded; execution-only with a task folder named `x$(touch pwn)` creates `.DONE` in that folder and no `pwn` file; the live log stays ≤ 2× cap and is not rewritten per chunk (spy on `readFileSync` or check inode/append behavior).

## Dependencies

- **None**

## Context to Read First

- `src/batch/worker-spawn.mjs` — spawn sites (~lines 165–178, 221–227), `collectChildOutput` (~lines 292–313), `terminateHungWorkerChild`
- `src/batch/worker-host.mjs` — spawn + `collectChildOutput` + classification (~lines 225–290, 345–370)
- `src/batch/worker-output.mjs` — `resolveWorkerOutputConfig`, `appendWorkerLiveLogChunk` (~lines 195–215), `createWorkerLiveLogWriter`
- `src/batch/review-spawn.mjs` ~line 298 — existing `error` listener pattern
- GitHub #306 (items 1–4; item 5 is SP-788)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/worker-spawn.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/worker-output.mjs`
- `src/batch/worker-output-live-log.mjs`
- `tests/batch/worker-spawn-errors.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-spawn-errors.test.mjs tests/batch/worker-output.test.mjs tests/batch/heartbeat.test.mjs` |
| fileScopeMustChange | `src/batch/worker-spawn.mjs`, `tests/batch/worker-spawn-errors.test.mjs` |
| fileScopeMustNotChange | `src/batch/attached-runner-promote.mjs`, `src/batch/engine-crash-guard.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce: spawn a missing binary via `spawnWorkerHandle`-like path without an `error` listener → unhandled `'error'`
- [ ] `rg -n "collectChildOutput|appendWorkerLiveLogChunk|spawnExecutionOnlyHandle" src tests` — list callers/tests (confirm `tests/batch/worker-output.test.mjs` exists; if named differently, use the real path in your verification and note it)
- [ ] Dependencies satisfied

### Step 1: Spawn error → launch_failed + positional `.DONE`

- [ ] `error` listener resolves once with `spawnError: true`
- [ ] `worker-host.mjs` classifies `launch_failed`; poll loop settles
- [ ] `.DONE` path passed as `$1`

**Artifacts:**
- `src/batch/worker-spawn.mjs`, `src/batch/worker-host.mjs` (modified)

### Step 2: Bounded output + append-only live log

- [ ] Tail buffer bounded by `maxBytes`
- [ ] Live log appends; truncates only past 2× cap
- [ ] `worker-output.mjs` ≤ 500 lines (extract to `worker-output-live-log.mjs` if needed)

**Artifacts:**
- `src/batch/worker-spawn.mjs`, `src/batch/worker-output.mjs` (modified); `src/batch/worker-output-live-log.mjs` (new, only if extracted)

### Step 3: Tests

- [ ] EACCES launch → `launch_failed`, no unhandled error
- [ ] Output cap
- [ ] `$(…)` task folder → no side effect, `.DONE` written
- [ ] Live log append-only and bounded

**Artifacts:**
- `tests/batch/worker-spawn-errors.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 owns runbook edits)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — worker output / live log notes

## Completion Criteria

- [ ] Worker spawn failure → `launch_failed` for that lane; engine keeps running
- [ ] Worker output memory bounded regardless of runtime
- [ ] Live log never re-read per chunk
- [ ] Task folder with `"` or `$(` executes no shell code
- [ ] Closes #306 (with SP-788)

## Git Commit Convention

- `fix(SP-787): handle worker spawn errors, bound output, stop shell interpolation (#306)`

## Do NOT

- Add process-wide `uncaughtException` / `unhandledRejection` handlers (SP-788)
- Edit `src/batch/worker-heartbeat.mjs` (SP-779 owned it in wave 1; keep changes out of the poll loop)
- Stream worker output to external sinks
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
