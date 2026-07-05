# SP-496: state_drift recovery UX — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issues #164, #168
- [x] Confirm invalid suggested command on main

---

### Step 1: Diagnosis fix
**Status:** ✅ Complete

- [x] Valid retry command with task id
- [x] Pause+retry fallback when task still running

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] spine-diagnosis-state-drift test added
- [x] No bare retry --force in suggestions

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Full test suite green
- [x] Coverage gate ≥77%

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook + release skill updated
- [x] Issues updated on GitHub
- [x] `.DONE` created

---

## Blockers

*None*

---

## Notes

- `buildSuggestedCommand("state_drift")` now emits `spine batch retry <taskId>` or `spine batch pause && spine batch retry <taskId>` when phase is running.
- Removed invalid `spine batch retry --force` suggestion.
