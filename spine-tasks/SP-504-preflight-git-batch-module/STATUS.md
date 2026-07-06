# SP-504: Split preflight: git + batch guard module — Status

**Current Step:** Step 0
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] SP-503 complete
- [ ] Git-clean and batch guard code reviewed
- [ ] Dependencies satisfied

---

### Step 1: Create git-batch.mjs module
**Status:** ⬜ Not Started

- [ ] git-batch.mjs created with extracted logic
- [ ] Private batch-state helpers moved with checks
- [ ] Module ≤500 LOC

---

### Step 2: Re-export from spine-preflight-lib
**Status:** ⬜ Not Started

- [ ] Moved code removed from spine-preflight-lib.mjs
- [ ] Re-exports wired from git-batch.mjs
- [ ] .pi/ dirty-path filtering preserved

---

### Step 3: Regression tests
**Status:** ⬜ Not Started

- [ ] Preflight and sequence-preflight tests pass
- [ ] Targeted tests pass

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] All failures fixed
- [ ] Build passes

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-05 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
