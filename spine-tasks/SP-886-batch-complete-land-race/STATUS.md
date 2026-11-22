# SP-886: Fix batch complete vs land-loop finalize race — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Dependencies satisfied (SP-885)
- [ ] Reproduce failure mode from #379 / late-finalize tests
- [ ] Map complete → reloadStateForTerminalWrite

---

### Step 1: Eliminate false-hard failure
**Status:** ⬜ Not Started

- [ ] Wait/retry or pending diagnosis for finalize race
- [ ] Preserve fail-closed for true state changes
- [ ] Keep journal observability

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Regression coverage
- [ ] Contract testCommand passing

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated
- [ ] Discoveries logged
- [ ] Create `.DONE`

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
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #379 (#371 regression).
