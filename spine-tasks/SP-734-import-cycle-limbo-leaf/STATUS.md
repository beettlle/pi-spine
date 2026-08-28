# SP-734: Break merge ↔ post-merge-limbo import cycle — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

## Step 0: Preflight

**Status:** ✅ Complete

- [x] Map maybeFinalizeAfterWaveMerge graph — callers: `mergeWaveLanesToOrch` (merge.mjs) + `attached-gate-limbo.test.mjs`; blast radius 2 (LOW, matches PROMPT). Cycles: all 11 allowlisted contain edge `engine-lanes/merge.mjs -> post-merge-limbo.mjs`; heavy deps closing cycles are `gate.mjs` and `resume-multi-validate.mjs`. `journal.mjs` + `merge/wave-merge-state.mjs` are cycle-safe.
- [x] SP-733 integrated — commit `51c31916` on lane base

## Step 1: Extract limbo finalize leaf

**Status:** ⬜ Not Started

- [ ] Leaf module + rewire imports

## Step 2: Shrink allowlist

**Status:** ⬜ Not Started

- [ ] Remove eliminated cycle strings

## Step 3: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run lint + Contract testCommand

## Step 4: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Notes

**Plan (Review Level 1):** Callback injection per PROMPT option.
1. New leaf `src/batch/post-merge-finalize.mjs` (imports only `journal.mjs` + `merge/wave-merge-state.mjs` — both cycle-safe): move `hydrateMergeResultsFromJournal`, `isLastWaveIndex`; add `createMaybeFinalizeAfterWaveMerge({detectPostMergeLimbo, tryFinalizeLimbo})` factory.
2. `post-merge-limbo.mjs`: delegate to leaf, re-export `hydrateMergeResultsFromJournal`/`isLastWaveIndex`, build `maybeFinalizeAfterWaveMerge` via factory with real deps.
3. `merge.mjs`: drop `post-merge-limbo.mjs` import; `mergeWaveLanesToOrch` gains optional `finalizeAfterWaveMerge` hook param.
4. Callers `engine.mjs` + `resume-multi.mjs` (already import post-merge-limbo) pass the real hook — logically required for injection (PROMPT allows callback injection).
5. Shrink `ALLOWED_CLUSTER_CYCLES` to actual post-change cycles (cycles reshape: limbo↔reconcile cycles via resume-multi remain; merge edges disappear).

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
| 2026-08-28 | Contract amend | fileScopeMustChange → post-merge-finalize.mjs (merge.mjs pre-landed by SP-732) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
