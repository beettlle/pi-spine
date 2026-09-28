# SP-798: Lane merge out-of-scope fail-closed — Status

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

- [ ] Reproduce discard
- [ ] Consumers listed
- [ ] Dependencies satisfied

### Step 1: Allow-list + fail-closed resolver
**Status:** ⬜ Not Started

- [ ] Allow-list default
- [ ] Blob + ours / fail closed
- [ ] Dead computation removed

### Step 2: Journal + failure classification + resume parity
**Status:** ⬜ Not Started

- [ ] Journal event + return field
- [ ] `MergeFailed` classification
- [ ] Resume parity; `resume.mjs` ≤ 500

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Real conflict fails closed
- [ ] Allow-listed journaled
- [ ] Untracked-overwrite
- [ ] Resume parity

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
