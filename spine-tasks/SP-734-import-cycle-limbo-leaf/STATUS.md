# SP-734: Break merge ↔ post-merge-limbo import cycle — Status

**Current Step:** Step 4
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

**Status:** ✅ Complete

- [x] Leaf module + rewire imports — `src/batch/post-merge-finalize.mjs` (imports only `journal.mjs` + `merge/wave-merge-state.mjs`); `merge.mjs` no longer imports `post-merge-limbo.mjs`; hook injected by `engine.mjs`/`resume-multi.mjs`

## Step 2: Shrink allowlist

**Status:** ✅ Complete

- [x] Remove eliminated cycle strings — all 11 allowlist entries reshaped; no cycle contains `engine-lanes/merge.mjs` anymore (remaining limbo↔reconcile cycles via `resume-multi.mjs` are SP-736 scope)

## Step 3: Testing & Verification

**Status:** ✅ Complete

- [x] Run lint + Contract testCommand — lint 0 warnings, typecheck clean, 19/19 contract tests pass; plus 33/33 related limbo/verdict tests (with `SPINE_IS_WORKER` unset, matching engine contract env per `CONTRACT_TEST_WORKER_ENV_KEYS`)

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
|---|---|---|
| 2026-08-28 | `detached-start-land-loop` test fails under worker env: `SPINE_IS_WORKER=1` leaks into spawned detached engine → nested-batch guard blocks it | Environmental only; engine contract runs strip `SPINE_IS_WORKER` (`CONTRACT_TEST_WORKER_ENV_KEYS`); passes with `env -u SPINE_IS_WORKER` |
| 2026-08-28 | `engine.mjs` + `resume-multi.mjs` edited outside literal File Scope | Logically required: callback injection needs the two `mergeWaveLanesToOrch` call sites to pass the hook (PROMPT allows callback injection); both already imported post-merge-limbo |
| 2026-08-28 | GitNexus `impact`/`context` tools returned mangled-target errors in this session | Used graph-context output from searches instead: `maybeFinalizeAfterWaveMerge` callers = merge.mjs + 1 test (blast radius 2, LOW); `detect_changes` post-edit: LOW, only `mergeWaveLanesToOrch` touched |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Contract amend | fileScopeMustChange → post-merge-finalize.mjs (merge.mjs pre-landed by SP-732) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
