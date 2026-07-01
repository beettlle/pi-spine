# SP-400: Batch start wave flag positional parse fix — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm `scope: "pending 0"` bug in `parseBatchArgs`

---

### Step 1: Exclude flag values from positional scope
**Status:** ⬜ Not Started

- [ ] Strip `--wave` / `--through-wave` / `--batch` / `--reason` values from positional tokens

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Regression tests in `batch-start-wave.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #65
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
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
