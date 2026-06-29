# SP-358: Detached start land loop finalize — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-29
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Batch 20260629T210738 timeline reviewed
- [ ] Detached engine exit path traced
- [ ] Resume postMergeLimbo detection reviewed

---

### Step 1: Engine finalize before detached exit
**Status:** ⬜ Not Started

- [ ] `finalizeBatchForIntegrate` awaited before engine exit
- [ ] `batch.land_loop_finalized` journal event
- [ ] `enginePid` cleared after finalize

---

### Step 2: Resume detached fast path reliability
**Status:** ⬜ Not Started

- [ ] `validateResumeBatch` limbo detection broadened
- [ ] No second engine spawn on synchronous finalize
- [ ] Diagnosis `suggestedCommand` updated

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Detached start land-loop regression test
- [ ] Resume --force limbo recovery test
- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated (if needed)
- [ ] Issue #41 closed
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
| 2026-06-29 | Task staged | PROMPT.md and STATUS.md created for GitHub #41 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
