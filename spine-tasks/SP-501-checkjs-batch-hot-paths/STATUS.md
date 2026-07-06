# SP-501: Enable checkJs on batch hot paths — Status

**Current Step:** Step 0
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code
> changes. Workers expand steps when runtime discoveries warrant it.

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] Current typecheck baseline captured
- [ ] Dependencies satisfied

---

### Step 1: Enable checkJs and fix tsc errors
**Status:** ⬜ Not Started

- [ ] `checkJs: true` in tsconfig.batch.json
- [ ] tsc errors resolved in four hot-path modules
- [ ] `@type {any}` on batch-state replaced in scoped modules
- [ ] Targeted typecheck passes

---

### Step 2: Extend typecheck-batch regression test
**Status:** ⬜ Not Started

- [ ] Test asserts `checkJs: true`
- [ ] Existing hot-path assertions preserved
- [ ] Targeted tests pass

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] All failures fixed
- [ ] Build passes

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged
- [ ] GitHub issue #178 closed

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
