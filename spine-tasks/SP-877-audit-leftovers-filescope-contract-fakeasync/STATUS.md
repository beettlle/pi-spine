# SP-877: Audit leftovers: fileScope fallback, contract.errors, fake-async bin guard — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-11-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm three leftover sites
- [x] Read fake-async guard scope

---

### Step 1: Three leftovers
**Status:** ✅ Complete

- [x] Validate fileScope env JSON
- [x] Surface contract.errors
- [x] Fix runSpinePlan + extend guard

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Cover each leftover path

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Making `runSpinePlan` sync breaks `assert.doesNotReject` in `tests/planner/plan-pending-empty.test.mjs` (out of File Scope) | Used mission's "or truly async" branch: real `await` on `fs.promises` artifact write in `bin/spine-plan.mjs`; out-of-scope test files untouched | `bin/spine-plan.mjs` |
| `extractBracedBody` in the fake-async guard grabbed destructured parameter `{` instead of the body brace, misclassifying genuinely-async functions with destructured params (e.g. `buildWorkerPiArgs`) as fake-async once `bin/` was swept | Fixed extractor to skip the parameter list first; backward compatible for non-destructured signatures | `tests/arch/fake-async.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-19 | Step 1 committed (fb8ff6be) | fileScope validation, contract_parse_failed surfacing, runSpinePlan async write, bin/ guard sweep |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
