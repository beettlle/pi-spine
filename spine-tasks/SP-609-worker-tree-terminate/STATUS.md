# SP-609: Worker tree terminate — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Teardown call sites mapped
- [x] Grandchild spawn path confirmed

### Step 1: Tree terminate helper

**Status:** ✅ Complete

- [x] Helper implemented
- [x] Wired into terminate paths

### Step 2: Tests + runbook

**Status:** ✅ Complete

- [x] Grandchild regression test
- [x] Runbook leftover-`pi` note

### Step 3: Testing & Verification

**Status:** 🟡 In Progress

- [x] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings

- `terminateLaneWorkers` (`worker-host.mjs`) only `process.kill(workerPid)` — used by `dismissBatch` (lifecycle) and `killLaneWorkers`/`abortBatch` (abort). GitNexus impact: LOW (2 direct callers).
- Stall / hung / in-poll abort use `workerChild.kill` / `terminateHungWorkerChild` (`worker-spawn.mjs` / `worker-heartbeat.mjs`) — same single-PID gap; FR requires tree-kill there too (touch as logically required).
- Runner (`spine-worker-runner.mjs`) `spawnSync("pi", …)` — grandchild stays in runner PGID by default; SIGKILL on runner alone orphans `pi` (~300–450 MB).

### Implementation

- `src/process/terminate-tree.mjs` — `listDirectChildPids`, `listDescendantPids`, `terminateProcessTree`
- Wired: `terminateLaneWorkers`, `terminateHungWorkerChild`, heartbeat abort kill
- Skipped `detached: true` spawn (CRITICAL blast radius); tree-walk sufficient
- Contract testCommand: typecheck + dismiss-orphan tests **2/2 pass**

## Discoveries

| Date | Discovery | Action |
|------|-----------|--------|
| 2026-07-10 | `terminateHungWorkerChild` / heartbeat abort are out of PROMPT File Scope but required by FR-REL231-02 | Touch as logically required; keep change additive (tree-kill) |
| 2026-07-10 | GitNexus CRITICAL on `terminateHungWorkerChild` / `spawnWorkerChild` | Avoid spawn option changes; only swap kill helper |
