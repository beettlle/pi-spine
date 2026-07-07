# SP-524: Planner wave size warning — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read `formatFileScopeOverlapWarnings` pattern in waves.mjs for warning style consistency

### Step 1: Wave size warn
**Status:** ✅ Complete

- [x] Add `collectWaveSizeWarnings(waves)` — warn when any wave has >8 tasks
- [x] Include in `buildPlan` return value and CLI plan output (visible to operator)

### Step 2: Tests
**Status:** ✅ Complete

- [x] `tests/planner/wave-size-warn.test.mjs`: 8 tasks silent, 9 tasks warns (M-CTR-04)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract testCommand
- [x] `spine plan pending` still works (warning is non-blocking)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Close #143
- [x] Create `.DONE`

---

## Blockers

*None*
