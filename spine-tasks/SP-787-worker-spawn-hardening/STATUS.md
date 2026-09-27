# SP-787: Worker spawn hardening — Status

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

- [ ] Reproduce unhandled spawn error
- [ ] List callers/tests
- [ ] Dependencies satisfied

### Step 1: Spawn error → launch_failed + positional `.DONE`
**Status:** ⬜ Not Started

- [ ] `error` listener, resolve once
- [ ] `launch_failed` classification; poll settles
- [ ] `.DONE` as `$1`

### Step 2: Bounded output + append-only live log
**Status:** ⬜ Not Started

- [ ] Tail buffer
- [ ] Append-only live log, 2× cap truncation
- [ ] `worker-output.mjs` ≤ 500 lines

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] EACCES → `launch_failed`
- [ ] Output cap
- [ ] `$(…)` folder safe
- [ ] Live log bounded

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
