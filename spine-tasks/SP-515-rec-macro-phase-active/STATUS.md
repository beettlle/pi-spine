# SP-515: Macro phase active workers — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read #165 and reproduce macro Failed + running batch

**Notes:** `deriveMacroPhase` maps `state_drift`/`engine_orphaned`/`worker_orphaned` to `failed` even when `batchPhase: running` and `hasActiveWorkerTasks: true`. Gate-pending tail with `allTasksTerminalSuccess` also misclassified as Failed.

### Step 1: Fix
**Status:** 🔄 In Progress

- [x] Adjust macro phase derivation when workers active under drift/orphan

### Step 2: Tests
**Status:** ⏳ Pending

- [x] Add macro-phase-active regression test

### Step 3: Testing & Verification
**Status:** ⏳ Pending

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery
**Status:** ⏳ Pending

- [ ] Close #165
- [ ] Create `.DONE`

---

## Blockers

- None (SP-512 complete)
