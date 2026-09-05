# SP-747: Gate approve/reject optional synthesis note — Status

**Current Step:** 0
**Status:** ⚪ Not Started
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⚪ Not Started

- [ ] Map approve/reject persistence fields and `spine gate status` printer
- [ ] Confirm auto-approve path and gate.json schema consumers

---

### Step 1: CLI + persistence
**Status:** ⚪ Not Started

- [ ] Parse optional `--synthesis` on approve and reject
- [ ] Persist `synthesis` string on gate record; omit/null when flag absent
- [ ] Auto-approve sets synthesis null or `"auto"`
- [ ] `spine gate status` displays synthesis when present

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Cover approve/reject/status synthesis cases

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update gate subsection in `docs/adoption/operator-runbook.md`
- [ ] Create `.DONE`
