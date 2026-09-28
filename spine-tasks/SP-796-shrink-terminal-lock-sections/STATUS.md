# SP-796: Shrink terminal lock sections to state I/O — Status

**Current Step:** Not Started
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Lock-section operations classified
- [ ] SP-792 landed
- [ ] Dependencies satisfied

### Step 1: Abort split
**Status:** ⬜ Not Started

- [ ] State I/O only under lock
- [ ] Cleanup after release

### Step 2: Complete + dismiss split
**Status:** ⬜ Not Started

- [ ] Cleanup after release
- [ ] Warnings + `batch.cleanup_failed`
- [ ] `lifecycle.mjs` ≤ 500 lines

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Lock not held during cleanup
- [ ] Cleanup failure reported

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|

## Blockers

_None._
