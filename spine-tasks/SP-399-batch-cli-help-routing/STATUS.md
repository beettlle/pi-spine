# SP-399: Batch CLI --help routing — Status

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

- [ ] Reproduce `batch start --help` accidental batch start
- [ ] Inventory help invocation patterns

---

### Step 1: Help routing
**Status:** ⬜ Not Started

- [ ] `printBatchHelp()` + early exit in `runSpineBatch`
- [ ] Optional `spine.mjs` guard for `batch help`

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `tests/cli/batch-help.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #64
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
