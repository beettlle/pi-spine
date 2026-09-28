# SP-791: Atomic batch-state read-modify-write helper — Status

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

- [ ] SP-790 landed
- [ ] Callers listed
- [ ] Dependencies satisfied

### Step 1: `updateSpineBatchState`
**Status:** ⬜ Not Started

- [ ] Single-lock RMW with structured result
- [ ] Shared guard/write path
- [ ] `state-io.mjs` ≤ 500 lines

### Step 2: Engine + pause paths
**Status:** ⬜ Not Started

- [ ] Engine merge inside lock
- [ ] Pause via helper
- [ ] Rollback respects terminal phase

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Two-process RMW
- [ ] Rollback-vs-terminal
- [ ] Helper unit cases

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
