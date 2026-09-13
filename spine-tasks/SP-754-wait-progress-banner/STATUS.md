# SP-754: wait start banner + periodic progress — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-09-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SP-753 headlines present on match/timeout
- [ ] Note current `--interval` default and sleep path
- [ ] Dependencies satisfied

---

### Step 1: Banner + periodic progress
**Status:** ⬜ Not Started

- [ ] Human mode: start banner once (until set, timeout, batchId when captured)
- [ ] Human mode: emit progress on an interval-aligned cadence
- [ ] Progress line includes diagnosis/phase/elapsed enough to prove liveness
- [ ] `--json` remains quiet during the loop by default
- [ ] Unit tests cover banner + at least one progress write before match

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
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
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
