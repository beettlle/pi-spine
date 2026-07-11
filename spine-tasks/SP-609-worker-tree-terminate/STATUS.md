# SP-609: Worker tree terminate — Status

**Current Step:** Step 0: Preflight
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** 🟡 In Progress

- [x] Teardown call sites mapped
- [x] Grandchild spawn path confirmed

### Step 1: Tree terminate helper

**Status:** ⬜ Not Started

- [ ] Helper implemented
- [ ] Wired into terminate paths

### Step 2: Tests + runbook

**Status:** ⬜ Not Started

- [ ] Grandchild regression test
- [ ] Runbook leftover-`pi` note

### Step 3: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings

- `terminateLaneWorkers` (`worker-host.mjs`) only `process.kill(workerPid)` — used by `dismissBatch` (lifecycle) and `killLaneWorkers`/`abortBatch` (abort). GitNexus impact: LOW (2 direct callers).
- Stall / hung / in-poll abort use `workerChild.kill` / `terminateHungWorkerChild` (`worker-spawn.mjs` / `worker-heartbeat.mjs`) — same single-PID gap; FR requires tree-kill there too (touch as logically required).
- Runner (`spine-worker-runner.mjs`) `spawnSync("pi", …)` — grandchild stays in runner PGID by default; SIGKILL on runner alone orphans `pi` (~300–450 MB).

### Plan (Step 1)

1. Add `src/process/terminate-tree.mjs`: list descendants (`pgrep -P` / Windows `taskkill /T`), kill descendants then root; try `-pid` process-group signal on Unix.
2. Wire into `terminateLaneWorkers`; also `terminateHungWorkerChild` + heartbeat abort kill.
3. Optionally spawn worker with `detached: true` so runner is PGID leader (stub-safe).
