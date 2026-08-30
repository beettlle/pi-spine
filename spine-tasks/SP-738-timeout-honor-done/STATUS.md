# SP-738: Honor .DONE before classifying worker timeout failure — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SP-737 `.DONE` on main
- [ ] Trace timeout → `task.failed` path when `.DONE` already on disk

---

### Step 1: Done-before-timeout classification
**Status:** ⬜ Not Started

- [ ] On timeout/exit, check lane `.DONE` (and doneInLane if already available) before failing
- [ ] Apply post-done grace; do not fail a completed worker for wall-clock budget alone

---

### Step 2: Regression tests
**Status:** ⬜ Not Started

- [ ] Simulate timeout with `.DONE` present → success / not timeout-failed
- [ ] Keep true stall/timeout without `.DONE` as failure

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
