# SP-236: Journal export markdown timeline — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-12
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Draft markdown timeline output shape
- [x] Review SP-235 jsonl export plumbing

---

### Step 1: Markdown export
**Status:** 🟡 In Progress

- [x] Implement markdown timeline formatter
- [x] Regression test for markdown output shape
- [x] Runbook feature summary
- [ ] Call `spine_review_step` after this step

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate passes (when applicable)
- [ ] All failures fixed

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

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
| 2026-06-12 | Task staged | PROMPT.md and STATUS.md created (size decomposition) |

---

## Blockers

*None*

---

## Notes

**Markdown timeline shape (Step 0):** H1 title with batch id; markdown table columns `Time (UTC) | Event | Lane | Task | Summary`; reuse `formatReplayTime` + `summarizeJournalEvent`; escape `|` in cell text.
