# SP-786: Quarantine corrupt batch-state instead of deleting it — Status

**Current Step:** Step 0 (Preflight)
**Status:** ⬜ Not Started
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduce deletions
- [ ] List callers/tests
- [ ] Confirm unconditional `assertNoActiveBatch`
- [ ] Dependencies satisfied

### Step 1: Quarantine + spine-only path + lock
**Status:** ⬜ Not Started

- [ ] Rename-to-quarantine
- [ ] `.pi` never modified
- [ ] Lock + `projectRoot` threading
- [ ] `lifecycle.mjs` ≤ 500 lines

### Step 2: Fail-closed start
**Status:** ⬜ Not Started

- [ ] Actionable throw on corrupt
- [ ] Holds with `skipPreflight`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Corrupt `.spine` quarantined
- [ ] `.pi` untouched
- [ ] Start refuses

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
