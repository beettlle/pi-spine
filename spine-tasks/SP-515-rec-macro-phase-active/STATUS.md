# SP-515: Macro phase active workers — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read #165 and reproduce macro Failed + running batch

### Step 1: Fix
**Status:** ✅ Complete

- [x] Adjust macro phase derivation when workers active under drift/orphan

### Step 2: Tests
**Status:** ✅ Complete

- [x] Add macro-phase-active regression test

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract testCommand (typecheck + macro-phase-active: 8/8 pass; coverage:check aborted 44 pre-existing unrelated failures)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Close #165
- [x] Create `.DONE`

---

## Blockers

- None (SP-512 complete)
