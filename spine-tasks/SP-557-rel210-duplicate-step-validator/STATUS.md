# SP-557: duplicate step validator — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-09
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #148 and SP-435 duplicate-step incident

**Notes:** SP-435 had duplicate `### Step 0:` (Preflight + Poll semantics). Parser accepted silently; workers confused on checkpoint discipline.

### Step 1: Validator
**Status:** ✅ Complete

- [x] Detect duplicate step numbers in `parseSteps()` or validate layer
- [x] Return actionable error with step numbers

### Step 2: Skill guidance
**Status:** ✅ Complete

- [x] Add Step B note: steps must be sequentially numbered, no duplicates

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Run contract `testCommand`
- [ ] `spine tasks validate` on a synthetic bad packet in test

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Comment on #148
- [ ] Create `.DONE`
