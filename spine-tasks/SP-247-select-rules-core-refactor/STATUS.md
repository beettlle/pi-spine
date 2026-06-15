# SP-247: Shared selection core refactor — Status

**Current Step:** Step 3 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-15
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-246 complete
- [x] Baseline select tests pass

---

### Step 1: Extract core
**Status:** ✅ Complete

- [x] `selectRulesFromManifest` implemented
- [x] Priority, blocklists, cap preserved

---

### Step 2: Rewire worker wrapper
**Status:** ✅ Complete

- [x] `selectRulesForWorker` thin wrapper
- [x] All existing tests pass unchanged

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate ≥77%

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Core API in Discoveries
- [ ] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 1 | plan | 1 | APPROVE | `.reviews/1-20260615T210331.md` |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `selectRulesFromManifest({ manifest, alwaysInclude, neverInclude, globMatch, scopePaths, standards?, neverLoad?, maxRules? })` → `RulesSelectionResult`; exported from `select.mjs` and `index.mjs` for SP-248 `selectRulesForReviewer` | handoff | `src/config/cursor-rules/select.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-14 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-15 | Step 0 preflight | SP-246 complete; baseline select tests pass |
| 2026-06-15 | Step 1 plan review | APPROVE via `spine review step --step 1 --type plan --stub` |

---

## Blockers

*None*
