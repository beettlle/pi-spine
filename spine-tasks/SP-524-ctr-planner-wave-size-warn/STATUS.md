# SP-524: Planner wave size warning — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-07
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read `formatFileScopeOverlapWarnings` pattern in waves.mjs for warning style consistency

### Step 1: Wave size warn
**Status:** 🔄 In Progress

- [x] Add `collectWaveSizeWarnings(waves)` — warn when any wave has >8 tasks
- [x] Include in `buildPlan` return value and CLI plan output (visible to operator)

### Step 2: Tests
**Status:** 🔄 In Progress

- [x] `tests/planner/wave-size-warn.test.mjs`: 8 tasks silent, 9 tasks warns (M-CTR-04)

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

---

## Blockers

*None*
