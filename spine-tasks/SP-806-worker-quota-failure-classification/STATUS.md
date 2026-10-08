# SP-806: Classify worker quota failures — Status

**Current Step:** Step 0: Preflight
**Status:** ⬜ Not Started
**Last Updated:** 2026-10-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Impact analysis recorded
- [ ] Consumer sweep recorded
- [ ] Dependencies satisfied

### Step 1: Classification + journal
**Status:** ⬜ Not Started

- [ ] Reclassification + `providerQuota`
- [ ] `worker.quota_exhausted`

### Step 2: Metrics + stub hook
**Status:** ⬜ Not Started

- [ ] `failureKind: "quota"`
- [ ] `SPINE_WORKER_STUB_FAIL_OUTPUT`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] z.ai 1308 stub batch
- [ ] Overloaded case
- [ ] Plain failure unchanged

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|

## Blockers

_None._
