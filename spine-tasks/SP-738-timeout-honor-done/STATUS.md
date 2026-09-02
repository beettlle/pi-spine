# SP-738: Honor .DONE before classifying worker timeout failure — Status

**Current Step:** 3 (Testing & Verification)
**Status:** 🟢 Executing
**Last Updated:** 2026-09-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-737 `.DONE` on main (`spine-tasks/SP-737-stall-static-null-progress` tree present on main @ f0a6b0f0)
- [x] Trace timeout → `task.failed` path when `.DONE` already on disk (see Trace below)


#### Step 0 trace — #273 timeout → task.failed

1. `bin/spine-worker-runner.mjs:446-453` — `spawnSync("pi", …, { timeout: SPINE_WORKER_PI_TIMEOUT_MS })` → on `ETIMEDOUT` prints `pi worker timed out` and `process.exit(124)`, even when the agent already wrote `.DONE` and committed all steps.
2. `src/batch/worker-heartbeat.mjs` poll loop — done branch breaks cleanly on child exit; stall branch classifies `stall_timeout` with only a same-iteration `existsSync` re-check at result-build time (race window).
3. `src/batch/worker-host.mjs:329` exit boundary — `ok = doneFound && (exitCode === 0 || postDoneTerminated)`; a 124 timeout exit with `.DONE` on disk → `ok:false`, classification `"failed"`.
4. `src/batch/engine-lanes.mjs:283-330` — `!workerResult.ok` → orphan-salvage only when `doneOnDisk && (doneFound===true || classification==="stall_timeout")` (v2.18 behavior, #274 — do not change); in v2.16 (#273 report) this fell through to `lane.died` → `task.status="failed"` → `task.failed` journal → `needs_retry`.

#### Plan (Review Level 2 — checkpoint before Step 1)

- **worker-heartbeat.mjs (stall boundary):** in the `now >= stallDeadline` branch, re-check `donePath` before stall warning/kill; if `.DONE` exists, journal `worker.done_honored_at_stall` (guarded by projectRoot/batchId) and `continue` so the done branch applies post-done grace (`postDoneGraceMs`) before any termination. Workers without `.DONE` keep the exact stall-warning → `stall_timeout` failure path (#272 untouched).
- **worker-host.mjs (exit boundary):** honor `.DONE` + wall-clock timeout exit (124, the runner's ETIMEDOUT exit code; engine SIGTERM/SIGKILL kills resolve as code 1 via `code ?? 1`, so 124 only originates from the runner's own timeout): `ok = doneFound && (exitCode === 0 || postDoneTerminated || doneFound&&124)` → classification `"succeeded"`, journal `worker.done_after_timeout`. Non-124 nonzero exits with `.DONE` keep existing salvage semantics (#274 untouched).
- **Tests (worker-post-done-grace.test.mjs):** (a) launch script writes `.DONE` then exits 124 → `ok:true`, `"succeeded"`, `worker.done_after_timeout` journaled; (b) exit 124 without `.DONE` → `ok:false` failure; existing tests keep true-stall and post-done-reap coverage.

#### Impact analysis (GitNexus, required before edit)

- `pollWorkerUntilSettled`: upstream CRITICAL — 1 direct caller (runWorker), 12 impacted, 5 processes.
- `runWorker`: upstream CRITICAL — 5 direct callers, 14 impacted, 6 processes.
- Mitigation: delta gated on `.DONE` presence + timeout exit code; regression tests for honor and keep-fail paths; existing #272/grace tests run in Contract testCommand.

#### Discoveries

| Finding | Disposition |
|---------|-------------|
| `doneInLane` in engine code = `.DONE` existing in lane worktree task folder — exactly the `donePath` checks in worker-host/poll loop | No extra check needed; lane `.DONE` check covers it |
| Engine orphan-salvage (#274) already routes `doneFound===true` failures to `worker.orphan_salvaged`; SP-738 adds success classification upstream so completed workers skip the salvage path entirely | Salvage code untouched per Do-NOT |
| 124 is unambiguous: runner exits 124 only on `ETIMEDOUT`; engine-initiated kills surface as exit code 1 (signal → `code ?? 1`) or synthetic failure result | Safe honor condition |

---

### Step 1: Done-before-timeout classification
**Status:** ✅ Complete

- [x] On timeout/exit, check lane `.DONE` (and doneInLane if already available) before failing — stall branch re-checks `donePath` before stall warning/kill; exit boundary honors `.DONE` + runner timeout exit 124. Lane `.DONE` check is the doneInLane signal (see Discoveries)
- [x] Apply post-done grace; do not fail a completed worker for wall-clock budget alone — stall-boundary `.DONE` hands off to the done branch (`postDoneGraceMs` honored before termination); exit-boundary `.DONE` + 124 → `ok:true` / `"succeeded"` with `worker.done_after_timeout` journal; stall-boundary `.DONE` journals `worker.done_honored_at_stall`

---

### Step 2: Regression tests
**Status:** ✅ Complete

- [x] Simulate timeout with `.DONE` present → success / not timeout-failed — `runWorker honors .DONE when wall-clock timeout exits 124 (SP-738 / #273)`: `ok:true`, `"succeeded"`, `doneFound:true`, exit 124, `worker.done_after_timeout` journaled
- [x] Keep true stall/timeout without `.DONE` as failure — `runWorker timeout exit 124 without .DONE still fails (SP-738 guard)` plus existing `runWorker pre-.DONE stall_timeout still works` (#272) and `runWorker silent stall still fails without heartbeats`

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint
- [ ] Run Contract testCommand

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updates
- [ ] Create `.DONE`
