# SP-332: spine scenarios CLI — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Review existing CLI subcommand patterns in bin/spine-cli/
- [x] Confirm registry API from SP-329

---

### Step 1: Implement spine scenarios CLI
**Status:** ✅ Complete

- [x] Add scenarios.mjs subcommand module
- [x] Implement list, show, materialize
- [x] Wire into bin/spine.mjs
- [x] Add active-batch guard for materialize

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [x] Add tests/cli/scenarios.test.mjs
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SPINE_SCENARIO_REGISTRY_ROOT env override added for CLI tests | Keep | bin/spine-cli/scenarios.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 43) |
| 2026-06-20 | Step 0–1 | scenarios.mjs + spine.mjs wiring |

---

## Blockers

*None*

---

## Notes

Plan: list/show read registry via SP-329 APIs; materialize writes batch-state + journal tail to target `.spine/` with `--force` guard when batch-state exists.
