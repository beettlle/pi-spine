# SP-740: Gate reopen for completed phase + runbook §5.2 — Status

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

- [ ] Confirm SP-739 `.DONE` on main
- [ ] Map stale_revision → delete gate → resume refuse completed

---

### Step 1: Re-open path for completed
**Status:** ⬜ Not Started

- [ ] Allow force-resume or dedicated `spine gate reopen` for completed + missing/stale gate
- [ ] Re-pin targetRevision to current orch tip and re-collect evidence
- [ ] Make integrate / gate status messages agree when gate absent

---

### Step 2: Runbook §5.2 + tests
**Status:** ⬜ Not Started

- [ ] Rewrite §5.2 recovery steps to the working path
- [ ] Regression: completed + no gate → reopen succeeds

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
