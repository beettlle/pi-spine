# Task: SP-799 — Async shell runner for contract commands (process-group timeout kill, output cap)

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** New process-management primitive; wrong group handling can leak processes or kill unrelated ones.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** Contract verification runs `spawnSync($SHELL -c <testCommand>)` with a 10-minute timeout (`src/batch/contract-exec.mjs` ~171-178) on the engine's single event loop while other lanes run concurrently; one slow check freezes every lane. On timeout, `spawnSync` returns `ETIMEDOUT` but leaves backgrounded grandchildren running, and the result is reported as exit 1 with no timeout mention (~195). `contract-exec.mjs` is at 498/500 lines, so the async runner must live in its own module.

## Mission

Partial #305 — Add a standalone async shell runner that SP-800 will switch contract verification onto.

1. **New module `src/batch/contract-spawn.mjs`** exporting `runShellCommandAsync(cwd, command, { env, timeoutMs, maxBuffer, shell })` → `Promise<{ exitCode, signal, stdout, stderr, timedOut, truncated, durationMs }>`:
   - `spawn(shell, [shellFlag, command], { cwd, env, detached: true (non-win32), stdio: ["ignore", "pipe", "pipe"] })`; resolve the shell and flag the same way `runContractTestCommand` does today (read ~150-200 and reuse or move that helper — do not duplicate it).
   - Capture stdout/stderr up to `maxBuffer` bytes each; beyond the cap keep draining the pipe but discard, and set `truncated: true`.
   - On timeout: `terminateProcessTree(child.pid, { signal: "SIGTERM" })`, wait up to 2 s for exit, then `terminateProcessTree(child.pid, { signal: "SIGKILL" })`; resolve with `timedOut: true` and `exitCode: null`.
   - `spawn` errors (e.g. `ENOENT` shell) resolve with `exitCode: 127` and the error message in `stderr`, never reject.
2. **No callers change in this task** — `contract-exec.mjs` and its callers are SP-800. The only allowed change in `contract-exec.mjs` is moving the shell-resolution helper into `contract-spawn.mjs` and importing it back (net line count must go down).
3. **Tests** `tests/batch/contract-spawn.test.mjs`:
   - `sleep 1` command with a concurrent `setInterval(…, 50)` counter: assert the counter advanced ≥ 10 times (event loop not blocked).
   - Timeout: command backgrounds a grandchild (`sleep 30 & echo $! > pidfile; wait`) with `timeoutMs: 500`; assert `timedOut: true` and the grandchild PID is gone within 3 s.
   - Output cap: command prints more than `maxBuffer`; assert `truncated: true`, captured length ≤ cap, process exits normally.
   - Missing shell → `exitCode: 127`, no rejection.
   - Skip POSIX-only cases on win32 with `{ skip: process.platform === "win32" }`.

## Dependencies

- **None**

## Context to Read First

- GitHub #305 (proposed solution steps 1 and 3)
- `src/batch/contract-exec.mjs` ~150-240 — current `runContractTestCommand` (shell resolution, env, maxBuffer, result shape)
- `src/process/terminate-tree.mjs` — `terminateProcessTree`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/contract-spawn.mjs`
- `src/batch/contract-exec.mjs`
- `tests/batch/contract-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-spawn.test.mjs tests/batch/contract-exec.test.mjs tests/batch/contract-verify-buffer.test.mjs` |
| fileScopeMustChange | `src/batch/contract-spawn.mjs`, `tests/batch/contract-spawn.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read `runContractTestCommand`; note shell resolution, env handling, result fields
- [ ] Confirm `terminateProcessTree` kills a detached group leader's descendants on macOS/Linux
- [ ] Dependencies satisfied

### Step 1: `runShellCommandAsync`

- [ ] Detached spawn, capped capture, drain beyond cap
- [ ] SIGTERM → SIGKILL tree kill on timeout; `timedOut` reported
- [ ] Spawn errors resolve with 127
- [ ] Shell resolution shared with `contract-exec.mjs` (no duplication; `contract-exec.mjs` line count goes down)

**Artifacts:**
- `src/batch/contract-spawn.mjs` (new), `src/batch/contract-exec.mjs` (modified — helper move only)

### Step 2: Tests

- [ ] Event-loop test
- [ ] Timeout kills grandchild
- [ ] Output cap
- [ ] Missing shell

**Artifacts:**
- `tests/batch/contract-spawn.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- None

## Completion Criteria

- [ ] `runShellCommandAsync` exists with timeout tree-kill and output cap
- [ ] Tests prove the event loop keeps running during a command

## Git Commit Convention

- `feat(SP-799): async contract shell runner with tree-kill timeout (#305)`

## Do NOT

- Make `runContractTestCommand` or `verifyContract` async (SP-800)
- Change contract semantics or retry counts
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
