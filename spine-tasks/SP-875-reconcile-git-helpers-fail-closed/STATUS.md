# SP-875: Reconcile git helpers: surface errors/timeouts; drop hardcoded operator branches — Status

**Current Step:** Step 3 — Testing & Verification
**Status:** 🟡 In Progress (Steps 0-2 done)
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
**Status:** ⬜ Not Started

- [x] Surface git failures/timeouts — added `isFatalGitProbeFailure` (string code ETIMEDOUT/ENOENT/EACCES or signal = fatal; numeric exit 1/128 = definitive "no", stays silent) + `probeGit` runner; all classify helpers (`isInsideGitRepo`, `gitRefExists`, `gitIsAncestor`, `listOrchBranches`, `listGitChangedPaths`, `listHumanOnlyPaths`, `keepPathsWithDifferentContent`, `pathExistsAtRef`) and `inspectHumanBaseSync` (rev-parses, merge-base, resolveCurrentGitBranch error) now record fatal failures into the existing `gitInspectionError` pattern → diagnosis flips to `git_unavailable` instead of silent mis-classification. Successful-path behavior unchanged.
- [x] Drop hardcoded username branch candidates — replaced `orch/cdelgado-${batchId}` + `.replace("*", "operator")` hack with generic `orch/spine-${batchId}` (convention already used by batch-meta-reconstruct/journal-rebuild).

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [x] Timeout/failure → inspection error — new tests: git-probe timeout (ETIMEDOUT shim) recorded as `inside_work_tree:` error; missing git binary (ENOENT) recorded; `inspectHumanBaseSync` timeout records `rev_parse(main):` into git signals + returns null.
- [x] Candidates exclude personal username — new test asserts `orch/spine-<batchId>` present, no `cdelgado`/`operator` in any candidate, and `gitInspectionError === null` in a healthy repo (definitive-no stays silent).

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
