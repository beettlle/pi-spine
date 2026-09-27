# SP-782: Integrate base-ref compare-and-swap — Status

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

- [ ] Confirm update-ref sites
- [ ] List integrate tests
- [ ] Dependencies satisfied

### Step 1: CAS + SHA merge-tree + dedupe
**Status:** ⬜ Not Started

- [ ] Expected-old SHA on fast-forward + plumbing
- [ ] Worktree path: first-parent check, no redundant update-ref
- [ ] merge-tree on SHAs
- [ ] Duplicate plumbing merge removed
- [ ] `BaseMoved` failure class
- [ ] Both files ≤ 500 lines

### Step 2: Race test
**Status:** ⬜ Not Started

- [ ] Base-moved race → `BaseMoved`, nothing orphaned
- [ ] Happy paths green

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] All integrate + salvage tests
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
