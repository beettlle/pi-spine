# SP-737: Stall watchdog treats static-null progress as non-progress — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read `checkpointSignalsChanged` / heartbeat progress snapshot construction
- [ ] Confirm existing stall tests and SAT-020 coverage gaps for static-null

---

### Step 1: Treat static-null as non-progress
**Status:** ⬜ Not Started

- [ ] Progress signal change must require a real signal delta (mtime/commit/dirty), not heartbeat emission or child liveness alone
- [ ] Static-null snapshots across heartbeats must not refresh the stall anchor
- [ ] Past budget: emit stall warning/kill journal events (match existing stall event types)

---

### Step 2: Regression tests
**Status:** ⬜ Not Started

- [ ] Unit/integration: simulated static-null heartbeats past budget → stall classification
- [ ] Child-alive-but-idle must not defeat stall (document SIGSTOP-style proxy in test comments)

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
