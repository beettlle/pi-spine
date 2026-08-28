# SP-733: Break resume path import of engine-lanes facade — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

## Step 0: Preflight

**Status:** ✅ Done

- [x] Baseline import-cycles cycles
- [x] SP-732 on main

## Step 1: Leaf imports for resume merge helpers

**Status:** 🔄 In Progress

- [ ] Replace engine-lanes.mjs imports in resume-* modules

## Step 2: Shrink allowlist

**Status:** ⬜ Not Started

- [ ] Remove eliminated ALLOWED_CLUSTER_CYCLES entries

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
| 2026-08-28 | Step 0 preflight | import-cycles test passes (9/9); all 11 ALLOWED_CLUSTER_CYCLES entries traverse `resume-multi.mjs -> engine-lanes.mjs`; SP-732 landed on main (54631314) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
