# SP-486: Lint zero-warnings — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Run lint and capture full warning list
- [ ] Categorize warnings
- [ ] Identify multi-warning files

---

### Step 1: Fix unused imports and local variables
**Status:** ⬜ Not Started

- [ ] Remove unused imports
- [ ] Remove unused local variables
- [ ] Clean up unused destructuring
- [ ] Lint passes with fewer warnings

---

### Step 2: Fix unused function params and exports
**Status:** ⬜ Not Started

- [ ] Prefix unused params with _
- [ ] Delete dead exports with no callers
- [ ] Lint passes with zero warnings

---

### Step 3: Enforce --max-warnings 0
**Status:** ⬜ Not Started

- [ ] Update package.json lint script
- [ ] Verify lint exits non-zero on warnings
- [ ] Verify CI uses npm run lint

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code)
- [ ] Lint produces 0 warnings, 0 errors
- [ ] All failures fixed
- [ ] Build passes

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged

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
| 2026-07-03 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
