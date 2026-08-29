# SP-736: Empty ALLOWED_CLUSTER_CYCLES and close #267 — Status

**Current Step:** Step 1
**Status:** 🟨 In Progress
**Last Updated:** 2026-08-29
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** ✅ Complete

- [x] SP-733–735 `.DONE` on main
- [x] Baseline cycles

## Step 1: Empty allowlist

**Status:** ✅ Complete

- [x] Clear ALLOWED_CLUSTER_CYCLES
- [x] Tighten unexpected-cycle assertion

## Step 2: Final cycle sweep

**Status:** ✅ Complete

- [x] Fix any remaining edges

## Step 3: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run lint + Contract testCommand

## Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-29 | `reconcile-batch.mjs` was outside declared File Scope but its one-line import rewire (Step 2 "fix any remaining import edges") is the sole edge breaking all 5 tracked cycles; identical function via existing `resume-validation.mjs` leaf re-export, same pattern as `batch-meta-reconstruct.mjs:11` | Required to empty allowlist; logged per scope policy |
| 2026-08-29 | 17 untracked legacy cycles remain (lane-commit, review-step, diagnosis/reconcile sans limbo, contract-verify, etc.) — different clusters, not tracked by #267 allowlist test | Out of scope; no action |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Contract amend | fileScopeMustChange → engine-lanes.mjs (import-cycles pre-landed by SP-733) |
| 2026-08-29 | Step 0 complete | Deps verified .DONE on main (8c2f85f6); baseline: 5 allowlisted limbo/reconcile cycles, 11/11 arch tests pass |
| 2026-08-29 | Cycle enumeration | Full batch graph has 20 canonical cycles; only 5 are tracked (limbo+reconcile); ALL 5 share edge `reconcile-batch.mjs -> resume-multi.mjs` (re-export of `computePendingTasks` from `resume-validation.mjs` leaf) |
| 2026-08-29 | Steps 1-2 done | Rewired `reconcile-batch.mjs` import to `resume-validation.mjs` leaf (SP-468 pattern); emptied allowlist; tightened assertion; engine-lanes.mjs facade header documents cycle-free ownership. Post-change: `post-merge-limbo.mjs` participates in zero cycles; 11/11 arch tests pass |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
