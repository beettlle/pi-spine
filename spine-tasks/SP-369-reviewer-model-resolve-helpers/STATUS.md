# SP-369: Reviewer per-type model resolution helpers — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #53 resolution rules
- [ ] Read `buildReviewerPiArgs` and SP-232 worker pin pattern

---

### Step 1: Implement resolution helpers
**Status:** ⬜ Not Started

- [ ] Add `src/config/agent-model-resolve.mjs` with model/thinking cascade for plan|code|final
- [ ] Export helpers; unit-test cascade, inherit, and missing per-type blocks

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run targeted tests
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Update STATUS.md discoveries if any
- [ ] Do not close #53 (delivery in SP-372)

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
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
