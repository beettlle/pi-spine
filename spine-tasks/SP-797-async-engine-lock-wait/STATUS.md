# SP-797: Async engine lock wait — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-791 + SP-794 landed (`saveEngineBatchState` in-lock merge at `pause.mjs:77`; `stealIfTokenMatches` in `batch-state-lock.mjs`)
- [x] Call sites + enclosing async status listed (see Notes)
- [x] Tests to update listed (see Notes)
- [x] Engine test file confirmed: `tests/batch/engine.test.mjs` exists
- [x] Dependencies satisfied

### Step 1: Async acquire
**Status:** ✅ Complete

- [x] `withBatchStateLockAsync`
- [x] Long-wait stderr line

### Step 2: Async engine save + call sites
**Status:** ✅ Complete

- [x] Async save + pause adopt (`saveEngineBatchState` + `adoptPauseIfRequested` async; no sync fallback — Step 0 found no sync non-engine callers)
- [x] Call sites awaited — `engine.mjs` ×10, `engine-lanes.mjs` ×7 (incl. 2 fire-and-forget worker callbacks now async arrows), `matrix-run.mjs` ×5

### Step 3: Tests
**Status:** ✅ Complete

- [x] Event-loop test (heartbeat ticks ≥ 5 during a 500 ms contended wait; write landed)
- [x] Re-entrancy test (nested sync `withBatchStateLock` + nested async variant)
- [x] Existing tests awaited (`post-done-plan-review-spawn`, `salvage-final-review-spawn-failed`, `attached-pause-persist` — setInterval callback uses `void` fire-and-forget)

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `npm run lint` clean
- [x] Contract `testCommand` — lint + typecheck clean; 48/48 pass (run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset per Environment note; with them set, `engine.test.mjs` fails `nested_batch_spawn_blocked` by design)
- [x] Batch suite — 1597/1597 pass
- [x] Coverage gate — 90.02% line coverage (threshold 77%), 2757/2757 pass
- [x] Fix all failures — compacted comments in `batch-state-lock.mjs` (501→499) and `engine-lanes.mjs` (503→499) to satisfy the Phase-23 500-LOC structural guard (`tests/cli/phase23-exit-verify.test.mjs`)

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Notes

### Step 0 findings — call sites (all enclosing functions already `async`)

| File | Lines | Enclosing function | Async? |
|------|-------|--------------------|--------|
| `src/batch/engine.mjs` | 196, 204, 261, 266, 272, 275, 362, 377, 401, 484 | `startBatch` (engine.mjs:73) | yes |
| `src/batch/engine-lanes.mjs` | 229, 279, 326, 342, 381 | `runNonMatrixTaskOnLane` (:197) | yes |
| `src/batch/engine-lanes.mjs` | 300, 305 | `onHeartbeat` / `onWorkerPid` arrow callbacks passed to `runWorker` | make arrows `async` — invokers (`worker-heartbeat.mjs:361`, `worker-host.mjs:296`) are async functions; promise intentionally un-awaited (fire-and-forget). Safe: `fn` serializes the live state object at lock-acquire time, so a queued heartbeat save writes latest state, never a stale snapshot. |
| `src/batch/engine-lanes/matrix-run.mjs` | 537 | `runMatrixTaskForResume` (:502) | yes |
| `src/batch/engine-lanes/matrix-run.mjs` | 676, 799, 876 | `runMatrixTaskOnLane` (:588) | yes |
| `src/batch/engine-lanes/matrix-run.mjs` | 711 | `runConcurrent` async row callback | yes |

`adoptPauseIfRequested` callers: only `startBatch` (async) → safe to make async. **No sync non-engine callers of `saveEngineBatchState` found** (rg over src+tests: only engine files + async tests) → no sync fallback path kept.

### Tests to update (beyond File Scope — logged per Step 0)

- `tests/batch/post-done-plan-review-spawn.test.mjs:152` — await
- `tests/batch/attached-pause-persist.test.mjs:93` — await; `:145` — setInterval callback becomes async
- `tests/batch/salvage-final-review-spawn-failed.test.mjs:61` — await

### Plan (Review Level 2; real-pi session — engine runs plan/code review after .DONE, no in-worker review spawn)

1. `withBatchStateLockAsync(projectRoot, fn, options)` in `batch-state-lock.mjs`: same acquire loop (`tryCreateLockFile` + `breakStaleLock` + token release + re-entrancy map) but `await setTimeout(POLL_INTERVAL_MS)` from `node:timers/promises`; sync `fn`, no await between acquire and release; re-entrant pass-through when held by this process; one `[spine]` stderr line when `waitedMs > 1000`.
2. `saveEngineBatchState` → `async` using `withBatchStateLockAsync` (nested `saveSpineBatchState` re-enters sync). `adoptPauseIfRequested` → `async`; await its `saveEngineBatchState`.
3. `await` every engine call site; make the two worker callbacks async arrows.
4. New test `tests/batch/batch-state-lock-async.test.mjs` (event loop alive during contended wait; re-entrancy; write landed) + await existing test call sites.

## Discoveries

| # | Finding |
|---|---------|
| 1 | Tests updated beyond File Scope (per PROMPT Step 3): `tests/batch/post-done-plan-review-spawn.test.mjs`, `tests/batch/salvage-final-review-spawn-failed.test.mjs`, `tests/batch/attached-pause-persist.test.mjs` — added `await` / `void` for now-async `saveEngineBatchState`. |
| 2 | No synchronous non-engine callers of `saveEngineBatchState` exist — no sync fallback path kept. CLI callers go through `state-io.mjs` / `updateSpineBatchState` and keep synchronous `withBatchStateLock`. |
| 3 | `engine-lanes.mjs` `onHeartbeat`/`onWorkerPid` are sync-typed callbacks invoked un-awaited by `worker-heartbeat.mjs` / `worker-host.mjs`; made them async arrows (fire-and-forget). Safe because `fn` serializes the live state object at lock-acquire time — a queued save writes latest state, never a stale snapshot. |
| 4 | Phase-23 structural guard (`bin/spine-cli/verify.mjs`, `tests/cli/phase23-exit-verify.test.mjs`) caps every `src/batch/*.mjs` at 500 LOC via `split(/\r?\n/).length` (trailing newline counts +1). Comment compaction kept both touched files at 499 wc-lines. |
| 5 | `.spine/rules-manifest.json` timestamp churned by a commit hook; reverted (`.spine/` is spine-owned, Do NOT modify). |

## Blockers

_None._
