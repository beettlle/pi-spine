# SP-875: Reconcile git helpers: surface errors/timeouts; drop hardcoded operator branches — Status

**Current Step:** Complete
**Status:** ✅ Complete — ready for engine reviews
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] List helpers that swallow errors — reconcile-classify.mjs: `isInsideGitRepo`, `gitRefExists`, `gitIsAncestor`, `listOrchBranches`, `listGitChangedPaths`, `listHumanOnlyPaths`, `pathExistsAtRef`, `keepPathsWithDifferentContent` (catch-all → false/[]); `inspectHumanBaseSync` rev-parse pair (catch → return null, hides human_base_diverged) and merge-base IIFE (catch → ""). Already correct: `countCommitsAhead` + `branch --merged` callers record via `recordGitInspectionError`.
- [x] Locate hardcoded branch candidates — reconcile-classify.mjs L212–213: `orch/cdelgado-${batchId}` and `"orch/spine-*-...".replace("*", "operator")`; generic convention elsewhere is `orch/spine-${batchId}` (batch-meta-reconstruct.mjs:177, journal-rebuild-structural.mjs:226).

---

### Step 1: Fail-closed helpers + candidates
**Status:** ✅ Complete

- [x] Surface git failures/timeouts — added `isFatalGitProbeFailure` (string code ETIMEDOUT/ENOENT/EACCES or signal = fatal; numeric exit 1/128 = definitive "no", stays silent) + `probeGit` runner; all classify helpers (`isInsideGitRepo`, `gitRefExists`, `gitIsAncestor`, `listOrchBranches`, `listGitChangedPaths`, `listHumanOnlyPaths`, `keepPathsWithDifferentContent`, `pathExistsAtRef`) and `inspectHumanBaseSync` (rev-parses, merge-base, resolveCurrentGitBranch error) now record fatal failures into the existing `gitInspectionError` pattern → diagnosis flips to `git_unavailable` instead of silent mis-classification. Successful-path behavior unchanged.
- [x] Drop hardcoded username branch candidates — replaced `orch/cdelgado-${batchId}` + `.replace("*", "operator")` hack with generic `orch/spine-${batchId}` (convention already used by batch-meta-reconstruct/journal-rebuild).

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Timeout/failure → inspection error — new tests: git-probe timeout (ETIMEDOUT shim) recorded as `inside_work_tree:` error; missing git binary (ENOENT) recorded; `inspectHumanBaseSync` timeout records `rev_parse(main):` into git signals + returns null.
- [x] Candidates exclude personal username — new test asserts `orch/spine-<batchId>` present, no `cdelgado`/`operator` in any candidate, and `gitInspectionError === null` in a healthy repo (definitive-no stays silent).

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand — `./scripts/worker-verify.sh` (typecheck + `SPINE_WORKER_STUB=1 npm test`) + `npm run coverage:check`. Typecheck PASS. Suite: 3317 tests / 3256 pass / 61 fail — **all 61 failures pre-exist identically at lane baseline 9664e705** (verified by reverting SP-875 files and re-running; identical failure sets, batch-engine/provider environment failures). SP-875 adds 4 tests, all passing, 0 new failures. Coverage: `reconcile-classify.mjs` 98.45% lines (≥77% gate; coverage:check exit-1 is caused by the same pre-existing suite failures, not coverage).
- [x] Fix failures — none attributable to SP-875 (0 new vs baseline).

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS — see Discoveries table
- [x] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 0754de8  bin/spine-worker-runner.mjs:286  WARNING  The guard `if (envScope)` treats an empty string as unset, so a worker spawned | advisory — noted, not blocking | contract review step |
| reviewCommand failed (exit 1): 0754de8  bin/spine-worker-runner.mjs:286  WARNING  The guard `if (envScope)` treats an empty string as unset, so a worker spawned | advisory — noted, not blocking | contract review step |
| reviewCommand failed (exit 1): 21d12c7  src/batch/reconcile-classify.mjs:140  WARNING  isFatalGitProbeFailure treats any Error with a string `code` property as  | advisory — noted, not blocking | contract review step |
| git probes exit 1/128 = definitive "no" (missing ref / not ancestor / not a repo); timeout = `code:"ETIMEDOUT"` + `signal:"SIGTERM"`; missing binary = string code (ENOENT) — verified empirically with spawnSync probes |Encoded in `isFatalGitProbeFailure`; ordinary "no" answers stay silent to avoid false `git_unavailable` on every repo without an orch branch | src/batch/reconcile-classify.mjs |
| `inspectHumanBaseSync` records fatal probe errors by mutating `ctx.git.gitInspectionError` (the inspectGitState signals object) so `deriveDiagnosis` flips to `git_unavailable` with no consumer changes | Documented in code; consumers (reconcile-batch, sync-base, integrate, resume-multi-validate) unchanged | src/batch/reconcile-classify.mjs |
| 61 pre-existing suite failures in this lane environment (batch-engine/stub/provider tests), identical at baseline commit 9664e705; full gate deferred to post-integrate release:check per task instructions | Not addressed (out of scope) | /tmp/sp875-verify.log vs /tmp/sp875-baseline-suite.log comparison |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | Helpers + candidates located; GitNexus impact UNKNOWN → text-search blast radius confirmed (4 inspectGitState callers, 2 inspectHumanBaseSync callers) |
| 2026-11-20 | Step 1 complete | probeGit/isFatalGitProbeFailure fail-closed refactor; generic orch candidates; commit dfe638b3 |
| 2026-11-20 | Step 2 complete | 4 new tests in reconcile-git-error.test.mjs; commit a51f0548 |
| 2026-11-20 | Step 3 complete | worker-verify + coverage:check; 0 new failures vs baseline; module coverage 98.45% |
| 2026-11-20 | Step 4 complete | STATUS discoveries recorded; .DONE created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
