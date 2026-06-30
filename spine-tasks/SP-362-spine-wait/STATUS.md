# SP-362: spine wait — Status

**Current Step:** Step 3 (Testing & Verification)
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-360 poll helper available (`runSpineWatch`, `DEFAULT_WATCH_INTERVAL_SEC`, `buildWatchSnapshot` in `src/cli/watch.mjs`)

---

### Step 1: Implement wait command
**Status:** ✅ Complete

- [x] `src/cli/wait.mjs`
- [x] CLI router wired

---

### Step 2: Tests and runbook
**Status:** ✅ Complete

- [x] `tests/cli/wait.test.mjs`
- [x] Runbook CI example

---

### Step 3: Testing & Verification
**Status:** 🟡 In Progress

- [ ] FULL test suite passing
- [ ] Coverage gate passes

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Issue #46 closed
- [ ] `.DONE` created

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-29 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0–2 | wait command, tests, runbook implemented |

## Notes (Plan — Review Level 1)

Reuse SP-360 watch poll loop: `reconcileBatch` + `DEFAULT_WATCH_INTERVAL_SEC` + `buildWatchSnapshot` for `--json` final snapshot. `runSpineWait` blocks until `diagnosis` ∈ `--until` set; exit 0 on match, 1 on timeout.
