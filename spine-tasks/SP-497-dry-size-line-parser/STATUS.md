# SP-497: DRY SIZE_LINE_RE parser — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-07-05
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] Confirm identical `SIZE_LINE_RE` in all three consumer modules
- [ ] Dependencies satisfied

---

### Step 1: Create shared size-line module
**Status:** ⬜ Not Started

- [ ] Add `src/tasks/packet/size-line.mjs` with shared exports
- [ ] Preserve `"S"|"M"|"L"|"XL"|null` return shape with uppercase normalization
- [ ] Targeted tests pass (`tests/tasks/contract-parse.test.mjs`)

---

### Step 2: Refactor consumers
**Status:** ⬜ Not Started

- [ ] `parse-prompt.mjs` imports shared module
- [ ] `task-packet-size.mjs` imports shared module
- [ ] `task-stall-budget.mjs` imports shared module
- [ ] Targeted tests pass (doctor + stall-budget)

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
- [ ] GitHub issue #182 closed

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
| 2026-07-05 | Task staged | PROMPT.md and STATUS.md created (v1.8.0 wave 0) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
