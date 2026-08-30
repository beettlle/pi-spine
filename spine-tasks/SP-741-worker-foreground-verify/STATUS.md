# SP-741: Worker prompt: foreground long verifications — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read worker.md verification / Monitor guidance
- [ ] Locate worker_done_missing diagnosis narration

---

### Step 1: Prompt guardrail
**Status:** ⬜ Not Started

- [ ] Add explicit: long verifications must be foreground; no background-and-exit
- [ ] Clarify incompatibility of completion wakes with worker lifecycle

---

### Step 2: Optional harness hint + tests
**Status:** ⬜ Not Started

- [ ] If cheap: detect live background children at exit-without-.DONE and add targeted hint
- [ ] Otherwise document-only is acceptable if prompt change is clear — note in STATUS

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
