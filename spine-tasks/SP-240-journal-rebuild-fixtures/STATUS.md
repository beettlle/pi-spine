# SP-240: Journal rebuild incident fixtures — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-14
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Review SP-221 structural rebuild implementation
- [x] Select incident fixtures to cover

**Selected fixtures:** `retry-clears-failed-classification`, `resume-parallel-lane-orphan`, `orphan-running-resume`, `pidless-ghost-running`, `resume-orphan-historical-failure` (5 of 6 — `lane-worktree-devcontainer` lacks structural journal events; covered by diagnosis tests).

---

### Step 1: Fixtures and docs
**Status:** ✅ Complete

- [x] Add incident fixture regression tests
- [x] Document limitations vs Babysitter replay in runbook
- [x] Call `spine_review_step` after this step

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

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
| `lane-worktree-devcontainer.json` uses `journalEvents` not `journalTail` and has no structural events | Out of scope for rebuild regression | `tests/fixtures/incidents/README.md` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-12 | Task staged | PROMPT.md and STATUS.md created (size decomposition) |
| 2026-06-14 | Step 0 preflight | SP-221 `deriveStructuralBatchStateFromJournal` reviewed; 5 fixtures selected |
| 2026-06-14 | Step 1 | Added `journal-rebuild-incidents.test.mjs` (8 tests); runbook Babysitter limitations section |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
