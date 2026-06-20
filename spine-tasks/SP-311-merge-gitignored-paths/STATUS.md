# SP-311: Merge gitignored path filter — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-19
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Issue #15 failure path reconstructed
- [ ] Merge and lane-commit `git add` call sites listed
- [ ] No existing check-ignore helper confirmed

---

### Step 1: Filter gitignored paths in merge and lane commit
**Status:** ⬜ Not Started

- [ ] `filterGitignoredPaths` helper added
- [ ] Merge conflict resolution skips ignored paths on `git add`
- [ ] `commitLaneWorktree` excludes gitignored paths from staging

---

### Step 2: Diagnosis and recovery hints
**Status:** ⬜ Not Started

- [ ] `merge_failed_gitignored` (or equivalent) in diagnosis taxonomy
- [ ] `suggestedCommand` documents repair + `resume --force`
- [ ] Runbook updated if behavior changed

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Regression test for gitignored coverage on task branch
- [ ] Lane commit gitignored guard test
- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77%)

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Operator-runbook merge recovery updated (if needed)
- [ ] Issue #15 closed
- [ ] `.DONE` created

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
| 2026-06-19 | Task staged | PROMPT.md and STATUS.md created for GitHub #15 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
