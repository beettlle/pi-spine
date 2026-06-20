# SP-313: Worker exit without .DONE diagnosis — Status

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

- [x] Issue #18 journal timeline reconstructed
- [x] Runner → journal output path confirmed
- [x] Orphan vs early-exit conflation points listed

---

### Step 1: Taxonomy and diagnosis surfacing
**Status:** ✅ Complete

- [x] Distinct diagnosis kind for done-missing exit
- [x] Reconcile/diagnosis mapping for task.failed payload
- [x] Headline + suggestedCommand cite worker log

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Regression test from issue #18 pattern
- [x] Diagnosis ≠ worker_orphaned assertion
- [x] FULL test suite passing
- [x] Coverage gate passes (≥77%)

---

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Operator-runbook updated
- [ ] Issue #18 closed
- [ ] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Fast done-missing exits land as `needs_retry` via `hasFailedTasks` branch; orphan path only when task still `running` with dead PID | Fix in deriveDiagnosis | `reconcile.mjs` |
| Output string originates in `bin/spine-worker-runner.mjs` stderr → worker-host output → `task.failed` payload | No runner change | `engine-lanes.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created for GitHub #18 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
