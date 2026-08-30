# SP-739: salvage --integrate opens gate when none exists — Status

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

- [ ] Reproduce no-gate salvage integrate failure in unit fixture
- [ ] Read `openIntegrateGate` / evidence collection APIs

---

### Step 1: Open gate from salvage
**Status:** ⬜ Not Started

- [ ] When salvageable and gate absent, open gate with salvage evidence + current orch tip pin
- [ ] Fail closed if lane is not salvageable / evidence insufficient
- [ ] Keep existing path when gate already open

---

### Step 2: Tests + runbook note
**Status:** ⬜ Not Started

- [ ] Test: no gate + salvageable lane → gate opened or integrate proceeds after open
- [ ] Document recovery in operator-runbook salvage section (brief)

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
