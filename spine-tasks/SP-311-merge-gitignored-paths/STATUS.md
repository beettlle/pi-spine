# SP-311: Merge gitignored path filter — Status

**Current Step:** Step 4 (complete)
**Status:** 🟢 Complete
**Last Updated:** 2026-06-20
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #15 failure path reconstructed
- [x] Merge and lane-commit `git add` call sites listed
- [x] No existing check-ignore helper confirmed

---

### Step 1: Filter gitignored paths in merge and lane commit
**Status:** ✅ Complete

- [x] `filterGitignoredPaths` helper added
- [x] Merge conflict resolution skips ignored paths on `git add`
- [x] `commitLaneWorktree` excludes gitignored paths from staging

---

### Step 2: Diagnosis and recovery hints
**Status:** ✅ Complete

- [x] `merge_failed_gitignored` (or equivalent) in diagnosis taxonomy
- [x] `suggestedCommand` documents repair + `resume --force`
- [x] Runbook updated if behavior changed

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Regression test for gitignored coverage on task branch
- [x] Lane commit gitignored guard test
- [x] FULL test suite passing
- [x] Coverage gate passes (≥77%)

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Operator-runbook merge recovery updated (if needed)
- [x] Issue #15 closed
- [x] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `git check-ignore` without `--no-index` misses tracked force-added gitignored paths | Fixed with `--no-index` in `filterGitignoredPaths` | `src/batch/git-helpers.mjs` |
| Ignored untracked files absent from porcelain; use `git ls-files -o -i` in lane commit | Implemented in `listIgnoredUntrackedPaths` | `src/batch/lane-commit.mjs` |
| Gitignored unmerged paths need `git rm --cached -f` after `--ours` checkout | Implemented in out-of-scope resolver | `src/batch/engine-lanes/merge.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-19 | Task staged | PROMPT.md and STATUS.md created for GitHub #15 |
| 2026-06-20 | Implementation complete | Filter helper, merge/lane commit guards, diagnosis, tests |

---

## Blockers

*None*

---

## Notes

*Verification: `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (980 pass); `npm run coverage:check` (87.28% ≥ 77%).*
