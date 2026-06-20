# SP-315: Engine orphan retry recovery — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Issue #20 timeline reconstructed
- [ ] Orphan detect → diagnosis path traced
- [ ] Retry/resume guard points listed

---

### Step 1: Reconcile orphan running tasks to retryable state
**Status:** ⬜ Not Started

- [ ] Dead PID reconciles task from running to failed
- [ ] batch retry allowed on orphan diagnosis
- [ ] resume --force allowed when engine dead
- [ ] suggestedCommand aligned

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Regression test from issue #20
- [ ] Retry without pause assertion
- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Operator-runbook updated
- [ ] Issue #20 closed
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
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created for GitHub #20 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
