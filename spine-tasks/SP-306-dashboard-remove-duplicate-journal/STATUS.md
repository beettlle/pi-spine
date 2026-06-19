# SP-306: Remove duplicate dashboard journal panel — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Duplicate render path confirmed (`renderDefaultStatusPanels` → `renderDefaultJournalTail`; `renderSnapshot` → `renderJournal` when `!vm.idle`)
- [x] HTML structure reviewed (`#default-journal-section` in `#default-status-panels` vs `#journal-heading` in `#active-panels`)

---

### Step 1: Remove duplicate UI
**Status:** ⬜ Not Started

- [ ] `default-journal-section` removed from index.html
- [ ] `renderDefaultJournalTail` removed; `renderDefaultStatusPanels` simplified

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] ui-contract tests updated
- [ ] Full test suite passing
- [ ] Coverage gate passing

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook checked
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
| 2026-06-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
