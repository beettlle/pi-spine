# SP-669: Parse Matrix section from PROMPT.md and expand in planner — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] SP-672 landed on `main`

---

### Step 1: Parse `## Matrix` table
**Status:** ⬜ Not Started

- [ ] Add `## Matrix` section recognition
- [ ] Parse table into row objects
- [ ] Expose `matrix` and `matrixColumns` in parsed task
- [ ] Preserve backward compatibility

---

### Step 2: Expand matrix tasks into virtual sub-lanes
**Status:** ⬜ Not Started

- [ ] Generate virtual sub-task per matrix row
- [ ] Sub-task ID format `SP-XXX[row_id]`
- [ ] `spine plan` lists sub-lanes
- [ ] Respect `lanes.maxParallel` and serial deps

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm run typecheck` passes
- [ ] Matrix parse tests pass
- [ ] Planner expansion tests pass
- [ ] Non-matrix tasks unchanged
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
