# SP-823: Idempotent rules manifest sync — Status

**Current Step:** Step 1: Idempotent write
**Status:** 🔵 In Progress
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Callers in File Scope
- [x] Line counts recorded
- [x] Dependencies satisfied

### Step 1: Idempotent write
**Status:** ⬜ Not Started

- [ ] Fingerprint guard

### Step 2: Remove the wrapper
**Status:** ⬜ Not Started

- [ ] Wrapper removed; callers updated

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] CLI temp repo
- [ ] Idempotency cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Clean manifest after the Contract run
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact `discoverCursorRules` (upstream): **HIGH** risk label, 27 impacted nodes, 4 direct depth-1 callers: `src/cli/rules.mjs:runRulesDiscover`, `src/config/reviewer-context.mjs:buildReviewerContext`, `src/config/spine-init-constants.mjs:runInitRulesDiscover`, `src/config/worker-context.mjs:buildWorkerContextAsync`. Risk is breadth-only: the guard changes write behavior, not the returned manifest schema (`ok`, `manifest`, `manifestPath` all preserved), so callers are compatible. |
| 2 | GitNexus impact `tryAutoResolveRulesManifestMergeConflict` (upstream): LOW risk, 0 graph callers. Real call sites found by rg, all in File Scope: `merge.mjs:497` (wrapper), `integrate-worktree.mjs:12,425` (import+call), `engine-lanes.mjs:60` (re-export), `tests/batch/rules-manifest-merge.test.mjs:14,239,260`. |
| 3 | `rules sync` + `REPO_ROOT` sweep: only `tests/cli/spine-rules.test.mjs:157` runs `runSpine(["rules","sync"], { cwd: REPO_ROOT })` — in File Scope. No other callers; no blockers. |
| 4 | Line counts: `integrate-worktree.mjs` 491 (SP-830 landed, was 498), `engine-lanes.mjs` 498, `merge.mjs` 886 (submodule, outside the 500 cap), tests 272/169/365. Steps 2 changes are line-neutral or removing in the two capped files. |
| 5 | Dependencies satisfied: `scripts/spine-stet-contract-run.sh` and `.review/config.toml` exist (SP-828); `integrate-worktree.mjs` already reflects SP-830 edits (491 lines). |

## Blockers

_None._
