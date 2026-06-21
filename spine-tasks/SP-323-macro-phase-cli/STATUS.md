# SP-323: Macro-phase in reconcile and CLI — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-322 macro-phase module API
- [x] Review existing status CLI output format

---

### Step 1: Wire macro-phase into reconcile and CLI
**Status:** ✅ Complete

- [x] Add macroPhase fields to reconcileBatch output
- [x] Print macro phase in spine status output
- [x] Include in --diagnose signals when verbose

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [x] Extend reconcile/status tests
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

---

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Add phase vs diagnosis vs macroPhase table to operator-runbook
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Gate record loaded once for both integrateGateOpen and deriveMacroPhase | Applied | reconcile.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 41) |
| 2026-06-20 | Step 0–1 complete | Wired deriveMacroPhase into reconcile + spine-status CLI |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
