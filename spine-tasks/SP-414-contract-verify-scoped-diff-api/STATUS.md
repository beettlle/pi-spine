# SP-414: Contract verify scoped diff API — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read GitHub issue #62
- [ ] Dependencies satisfied

---

### Step 1: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #62 cumulative diff failure examples

---

### Step 2: Scoped listChangedFiles
**Status:** ⬜ Not Started

- [ ] Add optional `sinceCommit` (SHA or ref) parameter
- [ ] Use `git diff --name-only sinceCommit..HEAD` when set
- [ ] Preserve `main...HEAD` when sinceCommit omitted

---

### Step 3: Unit tests
**Status:** ⬜ Not Started

- [ ] Test fixture worktree with two commits — scoped diff returns only second commit files
- [ ] Existing contract-verify tests still pass

---

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updated


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
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created for GitHub #62 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
