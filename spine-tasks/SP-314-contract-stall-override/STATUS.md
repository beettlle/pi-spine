# SP-314: Contract stall timeout override — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #19 stall timeline confirmed
- [x] resolveStallConfigForTask call chain traced
- [x] Contract parse schema reviewed

---

### Step 1: Parse and apply contract stall override
**Status:** ⬜ Not Started

- [ ] Contract stallTimeoutMinutes parsed from PROMPT
- [ ] resolveTaskStallMinutes uses max(global, size, contract)
- [ ] Worker-host and pi timeout wired

---

### Step 2: Operator guidance + optional grace
**Status:** ⬜ Not Started

- [ ] Operator-runbook matrix packet guidance
- [ ] extendGraceOnFileScope option documented or wired

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract override unit tests
- [ ] Pi timeout alignment test
- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Contract template updated (if needed)
- [ ] Issue #19 closed
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
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created for GitHub #19 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
