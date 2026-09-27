# SP-787: Worker spawn hardening — Status

**Current Step:** Step 4 (Testing & Verification)
**Status:** 🔄 In Progress — Steps 0–3 complete, Step 4 next
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce unhandled spawn error
- [x] List callers/tests
- [x] Dependencies satisfied

### Step 1: Spawn error → launch_failed + positional `.DONE`
**Status:** ✅ Complete

- [x] `error` listener, resolve once
- [x] `launch_failed` classification; poll settles
- [x] `.DONE` as `$1`

### Step 2: Bounded output + append-only live log
**Status:** ✅ Complete

- [x] Tail buffer
- [x] Append-only live log, 2× cap truncation
- [x] `worker-output.mjs` ≤ 500 lines

### Step 3: Tests
**Status:** ✅ Complete

- [x] EACCES → `launch_failed`
- [x] Output cap
- [x] `$(…)` folder safe
- [x] Live log bounded

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Reproduced on Node 26: spawning a non-executable script (EACCES) with no `error` listener crashes the process (`Unhandled 'error' event`, exit 1); `child.pid` is `undefined`, and `child.exitCode` is set to the **negative errno** (`-13`) when `'error'` fires. `'close'` **does fire after `'error'`** on spawn failure — so `collectChildOutput` needs a resolve-once guard, not just an `once('error')`. |
| 2 | Poll-loop settling needs no `worker-heartbeat.mjs` edit: on spawn failure `exitCode` is non-null (Node ≥26) and `collectChildOutput`'s error handler will defensively assign `child.exitCode = 127` when null/negative (plain writable property), so `pollWorkerUntilSettled`'s `workerChild.exitCode !== null` check breaks the loop on the next pass, and `childDone` resolution wakes the inter-poll race immediately. |
| 3 | GitNexus impact: `collectChildOutput` is **CRITICAL** (1 direct caller `runWorker` → 12 symbols, 6 execution flows: matrix/resume/non-matrix lane runners) — changes keep the `{exitCode, output}` return shape and only add an optional `spawnError` field. `appendWorkerLiveLogChunk` is LOW (internal caller + tests). `spawnExecutionOnlyHandle` has 1 caller (`runWorker`). |
| 4 | `tests/batch/worker-output.test.mjs` exists (162 lines, no overlap with the touched functions). No existing tests call `collectChildOutput` or `spawnExecutionOnlyHandle` directly. |
| 5 | **Contract conflict:** `tests/batch/live-worker-log.test.mjs` "appendWorkerLiveLogChunk rolls file with truncation marker when over max bytes" (cap 48, appends 40+40=80 bytes) asserts final content ≤ **1× cap** with a truncation marker. The PROMPT-specified 2×-cap append-only semantics (80 ≤ 96 → no truncation) mathematically cannot satisfy it. That test encodes the per-chunk-rewrite behavior this task replaces; its expectations will be updated to the new append-only contract (minimal edit) and reported in PROMPT Amendments. File is outside File Scope — flagged here because the scoped behavior change cannot ship with a permanently red batch suite. |
| 6 | EACCES test path confirmed: `resolveSafeWorkerLaunchScript` returns the conventional `scripts/spine-worker-launch.sh` when it exists (no executability check), so a non-executable script gives `useLaunchScript=true` → spawn EACCES via `spawnWorkerChild`. Review Level 0 in the test PROMPT.md keeps `assertReviewToolAvailable` green. |
| 7 | Implementation shape: `collectChildOutput(child, liveLogWriter, maxBytes)` keeps the `{exitCode, output}` shape and adds optional `spawnError: true` (exitCode 127, output = tail + String(err)); per-stream bounded tail buffers, combined string trimmed to last `maxBytes` preserving stdout-then-stderr order; `wait()` branch untouched (agentSession backend out of scope). No extraction needed — `worker-output.mjs` lands at exactly 500 lines, so `worker-output-live-log.mjs` was NOT created. Smoke-verified: hostile folder `x$(touch pwn)` → `.DONE` in folder, no `pwn` file; EACCES → single `{exitCode:127, spawnError:true}` result, `child.exitCode` flagged 127. |
| 8 | New test file: 6 tests, all passing (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 node --test tests/batch/worker-spawn-errors.test.mjs` → 6 pass / 0 fail). `tests/batch/live-worker-log.test.mjs` updated as flagged in Discovery 5 (one test rewritten to the append-only contract) → 10 pass / 0 fail. Live-log test uses a `readFileSync` spy (0 reads on the append hot path, ≤4 rewrites over 8 appends) plus inode stability to prove no per-chunk rewrite. |

## Blockers

_None._
