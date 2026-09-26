# SP-772: Type matrix/merge engine-lanes — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-771 landed (`.DONE` present; review-* in tsconfig include; commits merged)
- [x] Confirm matrix/merge still nocheck (all three carry `// @ts-nocheck` line 1)
- [x] Note LOC vs limit (see Discoveries)
- [x] Dependencies satisfied

### Step 1: Type matrix/merge engine-lanes
**Status:** ✅ Complete

- [x] Remove nocheck + JSDoc (matrix 4 errors, matrix-run 64, merge 42 — all fixed; see Discoveries)
- [x] Expand tsconfig.batch include (matrix/matrix-run/merge added)
- [x] Clear remaining engine-lanes allowlist entries (zero remain; stray double-tab on first entry fixed)

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand (`npm run lint && npm run typecheck && npx tsc --project tsconfig.batch.json --noEmit && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/ts-nocheck-guard.test.mjs` → exit 0; guard tests 4/4 pass)
- [x] rg nocheck empty under engine-lanes (exit 1, no matches; `src/batch/engine-lanes.mjs` also clean)
- [x] Fix failures — full stub suite: 2608 pass / 43 fail; A/B rerun of the 43 failing tests with HEAD vs HEAD~1 sources → identical 75/118 pass/fail both ways ⇒ zero regressions; all 43 are pre-existing worker-env failures (`SPINE_IS_WORKER=1` → `nested_batch_spawn_blocked` / spawn timeouts in batch-engine tests)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md (docs deferred to SP-773)
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| LOC: matrix 509, matrix-run 899, merge 753 — all in `src/batch/engine-lanes/` subdir, which `listBatchModuleLineCounts` (batch-loc-policy) does not count (top-level `src/batch/*.mjs` only) | Type in place; no policy conflict |
| `PHASE23_GRANDFATHERED_OVER_500` in `bin/spine-cli/verify.mjs` is already `[]` (emptied by SP-593) | Nothing to grow; leave as-is |
| `NOCHECK_ALLOWLIST` engine-lanes entries are exactly the three targets; first allowlist entry `src/batch/abort.mjs` has a stray double-tab indent (pre-existing) | Fix indent while pruning the three entries |
| `watch.mjs` in engine-lanes has no nocheck and is not in tsconfig include — already typed, out of scope | Leave untouched |
| `engine-lanes.mjs` facade calls `runMatrixTaskOnLane` with a `@type {{ maxParallel: number } & Record<string, any>}` bag (SP-671); that source type can never satisfy named required param props, so precise per-property JSDoc on `runMatrixTaskOnLane` broke the facade | Kept fix in-scope: param typed `Record<string, any>` with field docs as text; facade untouched |
| `maybeFinalizeAfterWaveMerge` resolves to `(params: object) => object \| null` via factory JSDoc (post-merge-finalize.mjs), so `finalizeAfterWaveMerge` param typed `((params: object) => unknown) \| null` |
| JSDoc property docs (`@param {string} params.x`) require `@param {object} params` — TS8032 with `Record<string, any>` param (verified empirically) | Matched existing repo convention: `Record<string, any>` for state/task/config bags, inline `/** @type {any} */` annotations for row-entry callbacks |
| `resolveRulesManifestMergeConflict` needed `/** @type {const} */` assertions on `ok`/`autoResolved` literals so spreads stay discriminated-union assignable | Followed existing discover.mjs const-assertion pattern |

## Completion Criteria

- [x] matrix/merge typed (tsc exit 0; nocheck removed from all three)
- [x] Zero engine-lanes allowlist entries (guard test live + count checks pass)
- [x] Closes #283 (last engine-lanes nocheck cluster; `refactor(SP-772): type matrix/merge engine-lanes modules (#283)`)
- [x] `PHASE23_GRANDFATHERED_OVER_500` untouched (still `[]`); LOC after typing: matrix 511, matrix-run 922, merge 785 (subdir — outside batch-loc-policy count)

## Blockers

_None yet._
