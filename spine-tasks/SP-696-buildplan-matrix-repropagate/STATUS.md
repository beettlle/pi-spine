# SP-696: Re-propagate matrix fields through buildPlan — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SP-698 landed
- [ ] Confirm buildPlan still omits matrix fields

---

### Step 1: Propagate matrix into buildPlan
**Status:** ⬜ Not Started

- [ ] Copy matrix/matrixColumns into tasksById
- [ ] Real buildPlan expands virtual row IDs
- [ ] No task_not_found with matrix E2E

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Planner + matrix execution regressions
- [ ] Scoped + FULL suite + coverage green

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook §2.4 updated
- [ ] `.DONE` created

---

## Blockers

Depends on SP-698

## Notes

Re-applies SP-689 after SP-697/SP-698; do not clear SP-689 `.DONE`.
