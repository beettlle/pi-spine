# SP-677: Metrics show usage rollups — Status

**Current Step:** Complete
**Status:** ✅ Complete (salvaged from aborted batch 20260720T235540; short-circuit rollup bug fixed on main)
**Last Updated:** 2026-07-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Completed

- [x] SP-676 field names confirmed: `tokensIn`, `tokensOut`, `estimatedUsd`, `role`

---

### Step 1: Rollup helpers
**Status:** ✅ Completed

- [x] `src/batch/metrics-rollup.mjs` + unit tests
- [x] Fixed short-circuit `||` so batch/model/role all aggregate

---

### Step 2: CLI surface
**Status:** ✅ Completed

- [x] `spine metrics show` / `--json` include `rollups` when usage present

---

### Step 3: Testing & Verification
**Status:** ✅ Completed

- [x] Scoped contract `testCommand` passing (`tests/batch/run-metrics.test.mjs` 18/18)
- [x] `npm run typecheck` green

---

### Step 4: Documentation & Delivery
**Status:** ✅ Completed

- [x] `.DONE` created (operator docs remain SP-682)

## Notes

Salvaged from lane-2 of aborted batch `20260720T235540` (Kimi quota). QUICK-REFERENCE docs deferred to SP-682.
