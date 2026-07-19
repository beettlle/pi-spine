# SP-670: Substitute matrix variables in contract and steps — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] SP-669 landed on `main`

---

### Step 1: Implement substitution helper
**Status:** ⬜ Not Started

- [ ] Add `substituteMatrixVariables(template, row)` to `src/planner/matrix.mjs`
- [ ] Replace `{matrix.column}` with row value
- [ ] Fail loudly on unknown column
- [ ] Preserve non-matrix behavior

---

### Step 2: Apply substitution to contract and steps
**Status:** ⬜ Not Started

- [ ] Substitute contract fields per sub-lane
- [ ] Substitute step commands before execution
- [ ] Preserve non-matrix tasks

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck` passes
- [ ] Unit tests for substitution helper pass
- [ ] Integration tests for contract substitution pass
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS.md updated
- [ ] Notes captured for SP-673

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
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
