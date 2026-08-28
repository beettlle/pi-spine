# SP-733: Break resume path import of engine-lanes facade — Status

**Current Step:** Step 4
**Status:** ✅ Done
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

**Status:** ✅ Done

- [x] Replace engine-lanes.mjs imports in resume-* modules

## Step 2: Shrink allowlist

**Status:** ✅ Done

- [x] Remove eliminated ALLOWED_CLUSTER_CYCLES entries

## Step 3: Testing & Verification

**Status:** ✅ Done

- [x] Run lint + Contract testCommand

## Step 4: Documentation & Delivery

**Status:** ✅ Done

- [x] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| 2026-08-28 | `SPINE_IS_WORKER=1` is set inside worker sessions and blocks `startBatch` in integration tests; contract-exec strips it via `CONTRACT_TEST_WORKER_ENV_KEYS` | Local contract testCommand runs need `env -u SPINE_IS_WORKER`; not a code defect |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Step 0 preflight | import-cycles test passes (9/9); all 11 ALLOWED_CLUSTER_CYCLES entries traverse `resume-multi.mjs -> engine-lanes.mjs`; SP-732 landed on main (54631314) |
| 2026-08-28 | Step 1 done | resume-multi/resume → `engine-lanes/merge.mjs`; resume-common → `engine-lanes/queue.mjs`; no thin re-export leaf needed |
| 2026-08-28 | Step 2 done | allowlist rewritten: 11 canonical cycles now end `resume-multi.mjs -> engine-lanes/merge.mjs`; facade removed from all cycles; comment marks SP-736 as final-empty owner; import-cycles test 9/9 |
| 2026-08-28 | Step 3 verified | lint clean; typecheck clean; contract testCommand 19/19 pass (run with SPINE_IS_WORKER stripped, matching contract-exec.mjs CONTRACT_TEST_WORKER_ENV_KEYS behavior — nested-batch guard otherwise blocks integration tests inside worker sessions) |
| 2026-08-28 | Step 4 done | CONTEXT.md SP-733 row → Done; `.DONE` created |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
