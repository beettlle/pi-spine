# SP-517: Dashboard wave completed under drift — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read #186 and dashboard snapshot wave logic

**Notes:** Root cause in `resolveWaveStatus` — terminal-success alone marks completed; lanes already gate on diagnosis (SP-447).

### Step 1: Fix
**Status:** 🔄 In Progress

- [x] Wave panel labels respect active diagnosis (drift/orphan overrides optimistic completed)

### Step 2: Tests
**Status:** 🔄 In Progress

- [x] UI contract test for drift scenario

### Step 3: Testing & Verification
**Status:** ⏳ Pending

- [ ] Run contract testCommand

### Step 4: Documentation & Delivery
**Status:** ⏳ Pending

- [ ] Close #186
- [ ] Create `.DONE`

---

## Blockers

- ~~SP-512~~ (done)
