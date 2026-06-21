# SP-329: Scenario registry schema and module — Status

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

- [x] Review existing incident README catalog
- [x] Review duplicated loadFixture helpers in tests

---

### Step 1: Implement scenario registry module
**Status:** ✅ Complete

- [x] Define registry.json schema and initial minimal file
- [x] Create scenario-registry.mjs with list/get/validate API
- [x] Add unit tests

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

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
| loadFixture duplicated across ~15 test files with per-directory paths | Deferred to SP-331 | tests/batch/, tests/cli/, tests/dashboard/ |
| Incident catalog in README maps fixture → batch → pattern → test | Informs registry schema (kind, fixturePath, tests) | tests/fixtures/incidents/README.md |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 43) |
| 2026-06-20 | Step 0 preflight | Reviewed incident README and loadFixture patterns |
| 2026-06-20 | Step 1 implementation | Added registry module, minimal registry.json, unit tests |

---

## Blockers

*None*

---

## Notes

Registry schema v1 fields: `id`, `kind` (incident|stub|adoption|recipe), `title`, optional `description`, `fixturePath`, `batchId`, `tests`, `docs`, `relatedTasks`, `tags`. SP-330 populates entries.
