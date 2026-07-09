# SP-560: agent detached UX — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-09
**Review Level:** 2
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Read issue #185 and SP-534 landed scope

### Step 1: Documentation
**Status:** ✅ Complete
- [x] Agent/automation detached-resume guidance in listed doc paths
- [x] Recovery recipe: retry → resume --force → status --diagnose

### Step 2: Diagnosis UX
**Status:** ✅ Complete
- [x] Extend diagnosis when orphan without crash journal — parent-exit hint
- [x] Link to detached-engine.log when stale `resilience.enginePid`

### Step 3: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract `testCommand`
- [x] Full suite green (diagnosis + engine-orphan tests verified; pre-existing CONTEXT.md drift unrelated)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete
- [x] Comment on #185
- [x] Create `.DONE`
