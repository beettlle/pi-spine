# SP-800: Async contract verification — Status

**Current Step:** Step 5
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-799 landed
- [x] Engine callers async
- [x] Baseline sync-call list
- [x] Dependencies satisfied

### Step 1: Async runner + verify
**Status:** ✅ Complete

- [x] Async runner + timeout message
- [x] Async verify + buffers/timeouts
- [x] `contract-exec.mjs` ≤ 500 (499 lines)

### Step 2: Engine callers
**Status:** ✅ Complete

- [x] Callers awaited
- [x] No un-awaited calls

### Step 3: Tests
**Status:** ✅ Complete

- [x] 14 existing test files awaited (96 tests pass across the 15 contract files)
- [x] New async/timeout tests (3 pass: event-loop liveness, runner `timedOut` + message, verify timeout message without exit code)

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `npm run lint` clean
- [x] Contract `testCommand` — 142 tests pass, exit 0 (run with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset, matching `buildContractTestEnv` stripping; with them set, `engine.test.mjs` hits the intentional `nested_batch_spawn_blocked` guard — environmental, not a regression)
- [x] Batch suite — `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`: 1570 pass, 0 fail
- [x] Coverage gate — `npm run coverage:check`: 90.05% in-scope line coverage (threshold 77%)
- [x] No sync calls left — `rg -n "spawnSync|Atomics" src/batch/contract-*.mjs` empty; no `sleepSync` in contract files (remaining repo `sleepSync` in `batch-state-lock.mjs`/`journal-checksum.mjs` is off the contract path)
- [x] Fix all failures — none outstanding

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Preflight baseline `spawnSync`/`sleepSync`/`Atomics` in `src/batch/contract-*.mjs`: `contract-exec.mjs:7` (import), `:92-94` (`sleepSync`/`Atomics.wait`), `:170` (`spawnSync` call), `:367` (`sleepSync` call). `contract-spawn.mjs` only mentions them in comments. |
| 2 | Both engine caller sites confirmed inside async functions: `review-final.mjs` `beforeReview: async () => {...}` (~296) and `matrix-run.mjs` `runMatrixSubLane` (async, ~322). |
| 3 | Repo root contains tracked scratch files `cur_exec.mjs` / `prev_exec.mjs` (identical copies of `src/batch/contract-exec.mjs`, committed by SP-799 worker in 89a85e09). Out of SP-800 File Scope — left untouched; they will drift stale but don't affect lint/typecheck/tests or the `src/batch/contract-*.mjs` sync-call criterion. |
| 4 | `runShellCommandAsync` reports cap-exceeding output as `truncated: true` (pipe keeps draining, child runs to completion) instead of spawnSync's ENOBUFS error; the async `runContractTestCommand` maps `truncated` → existing `bufferOverflow` result shape so buffer tests keep passing. |
| 5 | SP-799 test file `tests/batch/contract-spawn.test.mjs` already covers the primitive; SP-800 adds the verifyContract-level async/timeout tests in `tests/batch/contract-verify-async.test.mjs` (new). |
| 6 | Step 4 rg gate (`spawnSync|Atomics` in `src/batch/contract-*.mjs` must return nothing) initially matched two prose comments in SP-799's `contract-spawn.mjs` header ("uses spawnSync" — stale post-SP-800). Reworded those 2 comment lines (comment-only, no behavior) to keep the gate literally green and the docs truthful; logged as a File Scope escape-hatch change ("logically required to complete a scoped change"). |
| 7 | `docs/adoption/operator-runbook.md` ~line 237 still says testCommand runs through `spawnSync($SHELL, ["-c", …])` in `contract-exec.mjs` — now async `runShellCommandAsync` (same $SHELL -c shell semantics). PROMPT delegates docs to SP-803 ("Must Update: None"), so left untouched for SP-803. Author-facing guidance in §2.3 is otherwise unaffected. |
| 8 | Running the contract `testCommand` from inside the worker session with `SPINE_IS_WORKER=1` exported makes `engine.test.mjs` fail with the intentional `nested_batch_spawn_blocked` guard (SP-482). The engine's own contract exec strips those keys via `buildContractTestEnv`, so verification ran with them unset. |

## Plan (Step 1–3, Review Level 2)

1. **`contract-exec.mjs`**: drop `node:child_process` import + `sleepSync`; `runContractTestCommand` → `async` on `runShellCommandAsync` (new `timeoutMs` option, default 10 min); `timedOut` → `timedOut: true` + `timed out after N min` summary; `truncated` → existing `bufferOverflow` shape. `verifyContract` → `async`: retry loop awaits, `await setTimeout(ms)` from `node:timers/promises`, coverage fallback awaited with `maxBuffer`, `git diff --name-only HEAD` via `runShellCommandAsync` (30 s timeout, `CONTRACT_TEST_COMMAND_MAX_BUFFER`). New `contractTestTimeoutMs` config passthrough (mirrors `contractTestMaxBuffer`). Keep ≤ 500 lines (497 today; budget math: −14 removed, +14 added ≈ 497).
2. **`contract-verify.mjs`** wrapper → `async`. **`review-final.mjs`** ~304 and **`matrix-run.mjs`** ~322 `await verifyContract(...)`.
3. **Tests**: await all call sites in the 14 listed files (make enclosing `withWorktree` callbacks async); new `contract-verify-async.test.mjs` with (a) `sleep 2` contract + concurrent `setInterval` counter advancing, (b) `runContractTestCommand` timeout → `timedOut: true` + message, (c) `verifyContract` timeout message without exit code.

## Blockers

_None._
