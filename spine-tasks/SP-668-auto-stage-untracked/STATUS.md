# SP-668: Auto-stage untracked files before contract verify — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] No active batch running

---

### Step 1: Add untracked-file staging helper
**Status:** ✅ Complete

- [x] Locate where contract verify reads the diff for `fileScopeMustChange`
- [x] Add helper that lists untracked files and matches against `fileScopeMustChange` globs
- [x] Stage matching untracked files with `git add` before diff check
- [x] Leave tracked modifications untouched

---

### Step 2: Wire helper into contract verify
**Status:** ✅ Complete

- [x] Call helper in `contract-verify.mjs` before evaluating `fileScopeMustChange`
- [x] Surface staging failures as clear contract errors
- [x] Preserve existing behavior when no untracked files exist

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `npm run typecheck` passes
- [x] Regression test for untracked in-scope file passes
- [x] Regression test for untracked out-of-scope file passes
- [x] Targeted test command passes
- [x] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] STATUS.md updated with discoveries
- [x] Operator-runbook checked; updated only if relevant

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `verifyContract` computes changedFiles via `listChangedFiles` | Used `git diff HEAD` to capture index+worktree to preserve file scope behavior for untracked files | `src/batch/contract-exec.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
