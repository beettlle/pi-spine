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

**Status:** ⬜ Not Started

- [ ] Clear ALLOWED_CLUSTER_CYCLES
- [ ] Tighten unexpected-cycle assertion

## Step 2: Final cycle sweep

**Status:** ⬜ Not Started

- [ ] Fix any remaining edges

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

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Contract amend | fileScopeMustChange → engine-lanes.mjs (import-cycles pre-landed by SP-733) |
| 2026-08-29 | Step 0 complete | Deps verified .DONE on main (8c2f85f6); baseline: 5 allowlisted limbo/reconcile cycles, 11/11 arch tests pass |
| 2026-08-29 | Cycle enumeration | Full batch graph has 20 canonical cycles; only 5 are tracked (limbo+reconcile); ALL 5 share edge `reconcile-batch.mjs -> resume-multi.mjs` (re-export of `computePendingTasks` from `resume-validation.mjs` leaf) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
