# SP-823: Idempotent rules manifest sync — Status

**Current Step:** Complete
**Status:** ✅ Done — all completion criteria met
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
**Status:** ✅ Complete (commit 18f1b49c)

- [x] Fingerprint guard

### Step 2: Remove the wrapper
**Status:** ✅ Complete (commit c23dbbfa)

- [x] Wrapper removed; callers updated

### Step 3: Tests
**Status:** ✅ Complete (commit d712997a)

- [x] CLI temp repo
- [x] Idempotency cases

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Clean manifest after the Contract run
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact `discoverCursorRules` (upstream): **HIGH** risk label, 27 impacted nodes, 4 direct depth-1 callers: `src/cli/rules.mjs:runRulesDiscover`, `src/config/reviewer-context.mjs:buildReviewerContext`, `src/config/spine-init-constants.mjs:runInitRulesDiscover`, `src/config/worker-context.mjs:buildWorkerContextAsync`. Risk is breadth-only: the guard changes write behavior, not the returned manifest schema (`ok`, `manifest`, `manifestPath` all preserved), so callers are compatible. |
| 2 | GitNexus impact `tryAutoResolveRulesManifestMergeConflict` (upstream): LOW risk, 0 graph callers. Real call sites found by rg, all in File Scope: `merge.mjs:497` (wrapper), `integrate-worktree.mjs:12,425` (import+call), `engine-lanes.mjs:60` (re-export), `tests/batch/rules-manifest-merge.test.mjs:14,239,260`. |
| 3 | `rules sync` + `REPO_ROOT` sweep: only `tests/cli/spine-rules.test.mjs:157` runs `runSpine(["rules","sync"], { cwd: REPO_ROOT })` — in File Scope. No other callers; no blockers. |
| 4 | Line counts: `integrate-worktree.mjs` 491 (SP-830 landed, was 498), `engine-lanes.mjs` 498, `merge.mjs` 886 (submodule, outside the 500 cap), tests 272/169/365. Steps 2 changes are line-neutral or removing in the two capped files. |
| 5 | Dependencies satisfied: `scripts/spine-stet-contract-run.sh` and `.review/config.toml` exist (SP-828); `integrate-worktree.mjs` already reflects SP-830 edits (491 lines). |
| 6 | **Implementation notes:** fingerprint guard added in `discoverCursorRules` via module-private `loadExistingManifestForFingerprint` (returns null unless the existing manifest parses with `rules[]`, `excluded[]` arrays and string `generatedAt`; unreadable/invalid files fall through to a normal write). On fingerprint match: write skipped, returned manifest keeps existing `generatedAt`, `manifestPath` still returned. Verified by smoke test in /tmp: byte-identical second run, rewrite on frontmatter change, recovery from corrupt manifest. Note: body-only .mdc edits do NOT change the fingerprint — correct, since `fingerprintRulesManifest` covers parsed frontmatter metadata, matching existing drift/merge semantics. |
| 7 | **Stet session recovery (no `.review/` hand-editing):** the worktreeSetupHook artifacts were missing in this lane worktree (`stet: no session and missing .review/spine-stet-baseline.ref`); `stet doctor` was healthy (LM Studio qwen/qwen3.8-27b OK, OpenJev OK). Recovered by checking out the pre-worker baseline f4320d42 detached, running the sanctioned `scripts/spine-worktree-setup.sh` verbatim, and returning to the lane branch. Session opened at the correct baseline; `.review/spine-stet-baseline.ref` = f4320d42. |
| 8 | **Stet triage (9 findings, all dismissed, 0 real defects in this diff):** evidence per finding — 940b06e (engine-lanes re-export "breaks public API"): full removal was mission item 3; `rg tryAutoResolveRulesManifestMergeConflict src bin tests` → 0 matches. cb72360 (call site "not updated"): `integrate-worktree.mjs:425` IS `tryAutoResolveMergeConflicts(worktreePath, {})` — stale hunk. 4028b42 (undefined `generatedAt` spread): helper requires `typeof generatedAt === "string"` (discover.mjs ~192-205) — impossible by construction. 699d9d9 (barrel export missing): `engine-lanes.mjs:59` exports it, signature `(projectRoot, options = {})` at merge.mjs:320 — stale hunk. ed90e26/4ef4a11 (test name/body mismatch): both renamed/updated — stale hunks. bc826b5 (cpSync needs existing dest): `fs.cpSync` recursive creates the dest tree — verified in node; CLI test passes in isolation (1 pass/0 fail). 30883ff (unused import): used at discover.test.mjs:234-235 — stale hunk. 654bc95 (byte-identical assertion "may fail"): the implementation preserves `generatedAt` on fingerprint match — that is Step 1; suite exit 0. |
| 9 | **Stet reviewer bug pattern (qwen/qwen3.8-27b):** 5 of 9 findings (cb72360, ed90e26, 4ef4a11, 30883ff, partially 940b06e/699d9d9) claim code "not shown in the hunk" / "still references the old name" for content that IS present in the same commit — the reviewer appears to see only partial diff hunks. Worth an upstream stet issue. |
| 10 | **Verification evidence:** lint clean (eslint --max-warnings 0); typecheck clean (both tsconfig projects); Contract targeted suite (8 files, 60 tests) exit 0; `bash scripts/spine-stet-contract-run.sh lenient` exit 0 with `0 finding(s)`; post-Contract `git status --porcelain .spine/rules-manifest.json` empty. Line counts after: `integrate-worktree.mjs` 491 (unchanged, line-neutral swap), `engine-lanes.mjs` 497, `merge.mjs` 878. |
| 11 | **Full suite bonus evidence (operator ask):** `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER npm test` → 2898 tests, 2898 pass, 0 fail, exit 0, 171s; `.spine/rules-manifest.json` still clean afterwards — the #315 regression is dead for the whole suite, not just the targeted files. Post-integrate `release:check` remains the authoritative full-suite gate. |

## Blockers

_None._
