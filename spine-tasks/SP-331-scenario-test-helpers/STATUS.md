# SP-331: Centralize scenario materialize helpers — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Identify duplicated loadFixture patterns
- [x] Confirm registry entries from SP-330

---

### Step 1: Create shared helper and refactor tests
**Status:** ✅ Complete

- [x] Create tests/helpers/scenario-fixture.mjs
- [x] Refactor orphan-reconcile, journal-rebuild-incidents, orphan-detect-scope
- [x] Verify identical test outcomes

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Run refactored test files
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
| SP-330 registry not on lane-2 branch | Cherry-picked SP-330 commits (669c753, 3d9109d) | tests/fixtures/scenarios/registry.json |
| Duplicated helpers: loadIncidentFixture/materializeIncidentFixture vs loadFixture/materializeFixture | Centralized in scenario-fixture.mjs | tests/batch/*.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 43) |
| 2026-06-20 | Step 0 preflight | Identified duplicated helpers; cherry-picked SP-330 registry |
| 2026-06-20 | Step 1 | Created scenario-fixture.mjs; refactored 3 test files |

---

## Blockers

*None*

---

## Notes

Helper API: `loadScenario(id)` resolves fixture via registry; `materializeScenario(projectRoot, id)` writes batch-state + journal.
