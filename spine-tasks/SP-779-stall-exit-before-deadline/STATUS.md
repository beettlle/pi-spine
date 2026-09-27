# SP-779: Stall watchdog observes worker exit before deadline — Status

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

- [ ] Confirm deadline-before-exit ordering at HEAD
- [ ] List callers/tests of `pollWorkerUntilSettled`
- [ ] Dependencies satisfied

### Step 1: Exit-before-deadline ordering + injectable timing
**Status:** ⬜ Not Started

- [ ] Exit observed before deadline branch
- [ ] Injectable `deps = { now, sleep }`
- [ ] SP-738 / #272 behavior unchanged
- [ ] `worker-heartbeat.mjs` ≤ 500 lines

### Step 2: Deterministic tests
**Status:** ⬜ Not Started

- [ ] Virtual-clock tests
- [ ] One real-subprocess classification test
- [ ] Coverage skip removed
- [ ] Ordering regression test
- [ ] 20× loop result recorded

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
