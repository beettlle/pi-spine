# SP-781: Matrix row runtime metachar guard — Status

**Current Step:** Step 1 (Runtime guard)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Reproduce injection at HEAD — row value `alpha; printf PWNED > pwned.txt` substitutes into runCommand; `/bin/sh -c` runs the injected second command (pwned.txt created); `isRefusedContractMetacharCommand(substituted)` = true
- [x] Dependencies satisfied (none)

### Step 1: Runtime guard
**Status:** ⬜ Not Started

- [ ] Guard after substitution, before spawn
- [ ] Refused-row result + message
- [ ] `&&` allowed
- [ ] Injection tests (no spawn, journaled)
- [ ] `contract-matrix-subst` case

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
