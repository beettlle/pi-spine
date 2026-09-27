# Task: SP-783 — Matrix row shell timeout and output cap

**Created:** 2026-09-27
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** A hung or chatty matrix row holds a global lane slot forever or exhausts engine memory.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0
**Problem theory:** `runShellInDir` (`src/batch/engine-lanes/matrix.mjs`) spawns `/bin/sh -c` with no timeout, no kill, and appends every output chunk to one string. The contract path (`contract-exec.mjs`) has a 10-minute timeout and a `maxBuffer`; the matrix path has neither.

## Mission

Closes #297 (with SP-781) — Matrix row commands time out (killing the process tree) and keep only a bounded output tail in memory.

1. Extend `runShellInDir(cwd, command, extraEnv = null, options = {})` with `options.timeoutMs` and `options.maxOutputBytes`. Defaults are named constants: `DEFAULT_MATRIX_ROW_TIMEOUT_MS = 600_000` (matches the contract path) and `DEFAULT_MATRIX_ROW_OUTPUT_MAX_BYTES = 262_144` (matches the worker-output default). `SPINE_MATRIX_ROW_TIMEOUT_MS` (positive integer) overrides the timeout default, mirroring `SPINE_SYNC_TIMEOUT_MS`.
2. **Timeout:** on expiry, `terminateProcessTree(pid, { signal: "SIGTERM" })`, then escalate to `SIGKILL` after a short grace if the child has not closed. Resolve `{ exitCode: 124, output, timedOut: true }` and include `matrix row command timed out after <N>ms` in `output`. Clear the timer on normal close. Spawn the shell so its descendants are reachable by `terminateProcessTree` (e.g. `detached: true` process group on POSIX) — verify with a test that a grandchild `sleep` dies.
3. **Output cap:** keep only the last `maxOutputBytes` bytes (ring/tail buffer — never the full stream). When truncated, prefix a marker such as `[… N bytes truncated …]` and return `outputTruncated: true`.
4. Existing callers keep working without changes: `matrix-run.mjs` already treats any non-zero `exitCode` as a failed row. Return-shape additions (`timedOut`, `outputTruncated`) are optional fields.
5. Tests in a new file: timeout kills the tree and reports 124/`timedOut`; output cap bounds the string length; env override applies; existing `runShellInDir` tests in `matrix-execution.test.mjs` stay green.

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/matrix.mjs` — `runShellInDir` (~lines 288–318)
- `src/process/terminate-tree.mjs` — `terminateProcessTree`
- `src/batch/worker-spawn.mjs` — `terminateHungWorkerChild` (SIGTERM → SIGKILL pattern, ~line 262)
- `src/batch/worker-output.mjs` — `DEFAULT_MAX_BYTES` (tail cap precedent)
- `tests/batch/matrix-execution.test.mjs` — existing `runShellInDir` unit tests (~lines 287–360)
- GitHub #297 (proposed solution items 2–3)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/engine-lanes/matrix.mjs`
- `tests/batch/matrix-row-shell-limits.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-row-shell-limits.test.mjs tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix.mjs`, `tests/batch/matrix-row-shell-limits.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `runShellInDir` has no timeout/cap at HEAD; list callers (`rg -n "runShellInDir" src tests`)
- [ ] Dependencies satisfied

### Step 1: Timeout + output cap

- [ ] `options.timeoutMs` / `options.maxOutputBytes` with named-constant defaults
- [ ] `SPINE_MATRIX_ROW_TIMEOUT_MS` override (invalid values ignored)
- [ ] SIGTERM → SIGKILL tree kill on timeout; `exitCode: 124`, `timedOut: true`
- [ ] Bounded tail buffer with truncation marker; `outputTruncated: true`
- [ ] Timer cleared on normal close; no dangling handles

**Artifacts:**
- `src/batch/engine-lanes/matrix.mjs` (modified)

### Step 2: Tests

- [ ] Timeout kills a grandchild process and reports 124
- [ ] Output cap bounds memory (assert `output.length` ≤ cap + marker)
- [ ] Env override
- [ ] Existing `runShellInDir` tests green

**Artifacts:**
- `tests/batch/matrix-row-shell-limits.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 documents the timeout and env override)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §2.4 Matrix tasks

## Completion Criteria

- [ ] Row commands past the timeout are killed with their tree and reported as timed out
- [ ] Row output held in memory is capped
- [ ] Existing matrix fixtures green
- [ ] Closes #297 (with SP-781)

## Git Commit Convention

- `fix(SP-783): bound matrix row shell runtime and output (#297)`

## Do NOT

- Edit `src/batch/engine-lanes/matrix-run.mjs` (SP-781 owns it)
- Add a new `spine-config.json` key or schema field
- Change default stall budgets or lane-slot accounting
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
