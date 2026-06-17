# SP-260: Fix src→bin layer inversion for spine-config — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-17
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Import inventory complete
- [ ] No circular dependency risk

---

### Step 1: Move config loaders to src
**Status:** ⬜ Not Started

- [ ] src/config modules created
- [ ] bin re-exports wired
- [ ] Plan review complete

---

### Step 2: Rewire src imports
**Status:** ⬜ Not Started

- [ ] All src imports point to src/config
- [ ] Layer inversion test added
- [ ] Code review complete

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Full suite passes
- [ ] Coverage gate ≥77%
- [ ] spine doctor smoke passes
- [ ] Typecheck passes

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Zero bin imports confirmed
- [ ] `.DONE` created

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
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
