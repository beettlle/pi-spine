# SP-784: Integrate checkout sync safety — Status

**Current Step:** Step 5 (Documentation & Delivery)
**Status:** 🔄 Finalizing
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-782 on main (`tests/batch/integrate-base-cas.test.mjs` exists; `mergeOrchIntoBaseViaRefs` absent from src/ and tests/)
- [x] Reproduce both checkout effects (scratch repo, both confirmed on current code — see Discoveries)
- [x] Record LOC baselines (integrate.mjs 437, integrate-worktree.mjs 457, salvage-batch-integrate.mjs 490 — all ≤ 500)
- [x] Dependencies satisfied

### Implementation plan (Review Level 2)

1. `integrate-worktree.mjs`: import `listIntegrateDirtyPaths` (cycle check passed); inside `syncPlumbingMergePathsToWorktree`, intersect diff paths with the dirty set once, skip + record dirty paths, return `skippedDirtyPaths`, fix docstring. Add two small exported helpers used by both callers for parity: `syncMergePathsToCheckedOutBase` (gate: sync only when base checked out **now**, returns null otherwise) and `reportDirtyOverlap` (journals `integrate.dirty_overlap`, returns the `DirtyOverlap` warning string or null).
2. `integrate.mjs`: route fast-forward + plumbing sync through the gate wrapper; delete the dead `checkout` + `reset --hard` bare-catch block; attach `warnings: [DirtyOverlap …]` to the success result when non-empty. Keep `baseCheckedOutAtStart` (still read by the `integrate.completed` journal payload).
3. `salvage-batch-integrate.mjs`: same gate wrapper for the plumbing sync; overlap report + `warnings` on success result. LOC headroom is tight (490/500) — keep diff minimal.
4. Tests: extend feature-branch test with porcelain equality; new base-checked-out + dirty-path test (edit preserved, warning + journal event); unit test for `skippedDirtyPaths` in integrate-worktree-sync; salvage assertion.

> Note: real-pi session — engine runs plan/code review after .DONE (SP-195).

### Step 1: Safe sync in integrate
**Status:** ✅ Complete

- [x] Sync gated on base checked out now (`syncMergePathsToCheckedOutBase` gate wrapper; fast-forward + plumbing routes)
- [x] Dirty skip + `skippedDirtyPaths` + docstring (intersect via `listIntegrateDirtyPaths`; skip after exists-in-merge check)
- [x] `integrate.dirty_overlap` + warning (reported only after sync known-good; `warnings: [string]` on success result)
- [x] Dead code removed (checkout + `reset --hard` bare-catch block deleted; `baseCheckedOutAtStart` kept — still read by `integrate.completed` payload)

### Step 2: Salvage parity
**Status:** ✅ Complete

- [x] Same gate + dirty skip (plumbing sync via gate wrapper; `laneNumber` added to overlap event; `warnings` on salvage success result)

### Step 3: Tests
**Status:** ✅ Complete

- [x] Feature-branch porcelain unchanged (existing e2e extended; also asserts no overlap warning)
- [x] Dirty edit preserved + reported (plumbing e2e: edit survives, `main:tracked.txt` updated, `warnings` + `integrate.dirty_overlap` asserted)
- [x] Salvage assertion (e2e via `integrateSalvageableLane`: dirty path kept, `laneId: lane-1` on overlap event)
- [x] Unit coverage in integrate-worktree-sync (dirty skip + `skippedDirtyPaths`; gate wrapper null on feature branch) — 12/12 pass

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` — clean, `--max-warnings 0`)
- [x] Typecheck (`npm run typecheck` — both tsconfigs clean)
- [x] Contract `testCommand` — 18/18 pass (integrate-isolated + integrate-worktree-sync + integrate-base-cas)
- [x] Integrate + salvage tests — 63/63 pass (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/integrate*.test.mjs tests/batch/salvage*.test.mjs`)
- [x] Fix all failures (one regression found & fixed — see Discoveries #7/#8)

### Step 5: Documentation & Delivery
**Status:** 🔄 In Progress

- [x] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus index is stale (references `mergeOrchIntoBaseViaRefs`, removed by SP-782); verified preflight with grep instead. |
| 2 | Both #298 effects reproduced on pre-fix code: (a) feature-branch integrate staged `orch-work.txt` into the feature index (`A  orch-work.txt`); (b) `syncPlumbingMergePathsToWorktree` overwrote a dirty `tracked.txt` ("operator uncommitted edit" → "orch version"). |
| 3 | Impact of `syncPlumbingMergePathsToWorktree` is HIGH (7 nodes): 3rd caller `syncHumanCheckoutWithBase` (src/cli/sync-base.mjs) is outside File Scope. Change kept additive (new `skippedDirtyPaths` field ignored there; dirty-skip extends the same protection to `spine sync-base`). `tests/batch/integrate-sync-base.test.mjs` covers it and runs in the Step 4 glob. |
| 4 | LOC pressure: integrate-worktree.mjs exactly 500, salvage-batch-integrate.mjs 497 — JSDoc/props compacted to fit the ≤ 500 contract (`reportDirtyOverlap` docs use positional-style names for its destructured object). |
| 5 | In integrate.mjs, `mode: "worktree"` is unreachable (runIntegrateMerge only calls `mergeOrchIntoBaseIsolated` when base is checked out, which delegates to plumbing), so the deleted `checkout`/`reset --hard` fallback was the only worktree-mode handler. |
| 6 | Journal events expose payload under `event.payload` (normalizeJournalEvent nests extras); `laneNumber` is a META_KEY that lands on the event as `laneId: "lane-N"`. |
| 7 | **Regression found by `tests/batch/integrate-sync-base.test.mjs` (out-of-scope file, passes in Step 4 glob):** computing the dirty set from `git status` *after* the merge is unsound — once CAS moves the base ref, unmaterialized merged paths appear as ` M`/` D` vs the new HEAD, so the dirty check skipped everything (e.g. `orch-work.txt` never materialized). Fix: capture `preMergeDirtyPaths` BEFORE the merge in integrate + salvage and pass it via `syncMergePathsToCheckedOutBase(..., { dirtyPaths })`. |
| 8 | Second-order fix for the in-function compute (used by out-of-scope `sync-base.mjs`, where no pre-merge snapshot exists): a dirty entry counts as a local edit only when the file exists in the worktree (modified/untracked) or is tracked at `baseSha` (operator deleted it). Missing from both = merge output the ref move has not materialized → restore. Baseline A/B run on the pre-change commit confirmed the test was green before and after the two fixes. |
| 9 | `gitnexus detect_changes` after edits: changed symbols confined to the 3 in-scope files (`syncPlumbingMergePathsToWorktree`, `integrateOrchToBase`, `integrateSalvageableLane` + adjacent hunks); risk HIGH matches the known blast radius, covered by the 63-test green run. |

## Blockers

_None._
