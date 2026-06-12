# SP-235: Journal export jsonl CLI — Status

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

- [x] Review journal event schema
- [x] Draft jsonl export CLI flags (`--batch`, `--format jsonl`, `--output`)

---

### Step 1: Jsonl export
**Status:** 🟡 In Progress

- [ ] Add export subcommand with jsonl format
- [ ] Exit non-zero when journal missing
- [ ] Unit test jsonl output
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
| jsonl export reads raw `events.jsonl` verbatim for faithful audit export | Implemented | `src/batch/journal.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-12 | Task staged | PROMPT.md and STATUS.md created (size decomposition) |
| 2026-06-12 | Step 0 preflight | Schema reviewed; flags: `--batch`, `--format jsonl`, `--output` |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
