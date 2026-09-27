# SP-782: Integrate base-ref compare-and-swap — Status

**Current Step:** Complete
**Status:** ✅ Done — awaiting engine review/merge
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm update-ref sites (`integrate.mjs:96,112`, `integrate-worktree.mjs:173,370`)
- [x] List integrate tests (`rg -ln integrate tests/batch` → 46 files; key: integrate.test, integrate-isolated, integrate-fast-forward, integrate-worktree-sync, integrate-sync-base, integrate-timeout, batch-salvage-integrate, salvage-complete-after-integrate)
- [x] Dependencies satisfied (none)
- [x] GitNexus impact on all 4 symbols: LOW risk, 1 direct caller each; `mergeOrchIntoBaseIsolated` signature unchanged so salvage path untouched

### Step 1: CAS + SHA merge-tree + dedupe
**Status:** ✅ Complete

- [x] Expected-old SHA on fast-forward + plumbing (`casUpdateBaseRef` shared helper)
- [x] Worktree path: first-parent check, no redundant update-ref
- [x] merge-tree on SHAs (`--write-tree <baseSha> <orchSha>`)
- [x] Duplicate plumbing merge removed (`mergeOrchIntoBaseViaRefs` deleted, +dead `mergeTreeOutputHasConflict`)
- [x] `BaseMoved` failure class (exact message per PROMPT)
- [x] Both files ≤ 500 lines (437 / 452)
- [x] Targeted smoke: 11/11 existing tests green (isolated, fast-forward, worktree-sync)

### Step 2: Race test
**Status:** ✅ Complete

- [x] Base-moved race → `BaseMoved`, nothing orphaned (git PATH-shim seam; FF, plumbing, and worktree variants all proven)
- [x] Happy paths green (direct `casUpdateBaseRef` + `plumbingMergeOrchIntoBase` tests; existing suites green)
- [x] merge-tree-on-SHAs asserted via shim argv log (both merge-tree args are 40-hex SHAs; base arg = pre-move capture)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint: `npm run lint` — exit 0, 0 warnings (fixed 2 unused vars in new test)
- [x] Typecheck: `npm run typecheck` — exit 0
- [x] Contract `testCommand` — 14/14 pass (base-cas + isolated + worktree-sync)
- [x] All integrate + salvage tests — 59/59 pass
- [x] Fix all failures — none remaining

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (7 in table below)
- [x] Runbook §4 Land loop checked — no contradiction found; `BaseMoved` runbook row owned by SP-789 per Do-NOT scope
- [x] Create `.DONE`

---

## Plan (Step 1)

1. `integrate-worktree.mjs`: add exported `casUpdateBaseRef({projectRoot, baseBranch, newSha, expectedOldSha})` — `git update-ref refs/heads/<base> <new> <expected>`; on failure return `{ok:false, failureClass:"BaseMoved", error:"<base> moved during integrate (expected <old>, found <current>) — re-run spine integrate"}` (`<current>` from fresh rev-parse).
2. `plumbingMergeOrchIntoBase`: export; `merge-tree --write-tree <baseSha> <orchSha>` (SHAs not names); CAS update-ref with expected = captured `baseSha`.
3. `mergeInIntegrateWorktree`: capture `baseShaBefore` pre-merge; drop redundant `update-ref`; verify `mergeCommit^1 === baseShaBefore`, else `BaseMoved`.
4. `integrate.mjs`: delete `mergeOrchIntoBaseViaRefs` (+ unused `execFileSync` import); `runIntegrateMerge` calls exported `plumbingMergeOrchIntoBase`; `fastForwardOrchIntoBase` CAS via `casUpdateBaseRef` with expected = `baseShaBefore`.
5. Step 2 race test: git PATH shim (test seam per PROMPT) intercepts `update-ref refs/heads/<base>` to land a concurrent commit before forwarding → CAS must fail with `BaseMoved`; worktree-path variant arms on `worktree add` then moves base after the capture `rev-parse`; shim logs argv so merge-tree SHA usage is asserted; direct unit tests for `casUpdateBaseRef` and `plumbingMergeOrchIntoBase` happy path.

## Discoveries

| # | Discovery |
|---|-----------|
| 1 | Real-pi worker session (`SPINE_IS_WORKER=1`): in-worker `spine_review_step` returns skipped; engine owns reviews after `.DONE`. |
| 2 | `mergeInIntegrateWorktree` currently no-ops its `update-ref` in the normal case (merge already advanced the ref) and only fires when base moved post-merge — exactly the clobber window the CAS removes. |
| 3 | Worktree-path first-parent check catches base moves between worktree provisioning and SHA capture; the merge itself advances the ref so no `update-ref` exists to race on that path. |
| 4 | Salvage (`salvage-batch-integrate.mjs`, read-only) consumes merge results generically (`ok`/`failureClass`/`error`/`mode`/`mergeCommit`) — `BaseMoved` flows through `batch.salvage_integrate_failed` without code changes. |
| 5 | `mergeInIntegrateWorktree` (worktree merge) is reachable from `mergeOrchIntoBaseIsolated` only when base is NOT checked out in projectRoot — i.e. the salvage route; `runIntegrateMerge` goes FF → isolated-plumbing (base checked out) → ref-plumbing. Race test targets it via direct `mergeOrchIntoBaseIsolated` call. |
| 6 | Up-to-date (no-op) worktree merges leave HEAD unchanged, so the new first-parent check needed a `mergeCommit === baseShaBefore` guard to avoid a false `BaseMoved` (matches old no-op behavior). |
| 7 | Git PATH-shim seam (test-only): a `git` wrapper script on PATH intercepts the CAS `update-ref` (or post-capture `rev-parse` for worktree mode) to land a concurrent commit deterministically; also logs argv for merge-tree SHA assertions. |

## Blockers

_None._
