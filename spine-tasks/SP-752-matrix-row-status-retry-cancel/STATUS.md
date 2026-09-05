# SP-752: Per-row matrix status, retry, and cancel — Status

**Current Step:** 0
**Status:** ⚪ Not Started
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⚪ Not Started

- [ ] Map `task.matrixRows` status fields and journal events
- [ ] Map batch retry / cancel entry points and ID parsing

---

### Step 1: Status + row retry/cancel
**Status:** ⚪ Not Started

- [ ] Show per-row status under parent
- [ ] Diagnose failing row ids
- [ ] Retry single `SP-X[rowId]`
- [ ] Cancel single row vs whole matrix
- [ ] JSON includes row array when present

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update runbook §2.4 ops
- [ ] Create `.DONE`
