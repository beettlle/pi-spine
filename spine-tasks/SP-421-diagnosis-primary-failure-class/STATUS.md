# SP-421: Diagnosis primary failure class taxonomy — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #74
- [x] Dependencies satisfied

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce with batch 20260701T201456 fixture or journal excerpt from #74

---

### Step 1: Taxonomy + headline
**Status:** ✅ Complete

- [x] Map classification → diagnosis headline + suggestedCommand
- [x] Prefer task-level primary failure over generic worker-launch text

---

### Step 2: Regression tests
**Status:** ✅ Complete

- [x] Add tests for DirtyWorktree, review_exhausted, contract_failed headlines
- [x] Assert hasFailedTasks aligns with failed task list

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite passing
- [x] Coverage gate (if applicable)
- [x] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updated
- [x] Issue closed
- [x] .DONE created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `DirtyWorktree` substring matched `worktree` in launch-failure haystack | Fixed in `diagnosis-launch-failure.mjs` | classifyLaunchFailureHaystack |
| `hasFailedTasks` false when segment drift + `failedTasks` counter > 0 | Fixed in `reconcile.mjs` | hasFailedTasks derivation |
| Full suite has 1 pre-existing flaky `contract-stall-override` failure | Out of scope | tests/batch/contract-stall-override.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-02 | Task staged | PROMPT.md and STATUS.md created (#74) |
| 2026-07-02 | Implementation | Primary failure taxonomy + tests + runbook |

---

## Blockers

*None*

---

## Notes

Root cause: `inferLaunchFailureKind` treated `DirtyWorktree` journal text as `worktree_unhealthy` because the token contains "worktree". Primary failure exit reasons now short-circuit launch inference; `hasFailedTasks` aligns with segment drift and `failedTasks` counter.
