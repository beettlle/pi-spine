# SP-101: Normalize lane worktree gitdir paths — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Bug report pattern confirmed: lane `.git` → `gitdir: /workspace/...`
- [ ] `provisionLaneWorktree` has no post-add normalization today

---

### Step 1: Normalize git metadata at provision
**Status:** ⬜ Not Started

- [ ] `normalizeLaneWorktreeGitPaths` implemented
- [ ] Admin `.git/worktrees/lane-N/gitdir` uses relative path
- [ ] Wired from `provisionLaneWorktree` after `git worktree add`
- [ ] `assertLaneWorktreeGitHealthy` implemented
- [ ] Plan review completed

---

### Step 2: Resume repair + tests
**Status:** ⬜ Not Started

- [ ] `repairLaneWorktreeGitMetadata` exported (idempotent)
- [ ] Repair wired in `resume-multi.mjs` before worker spawn
- [ ] Regression tests pass
- [ ] Code review completed

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL suite + coverage ≥77%

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| — | — | — | — | — |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| — | — | — |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-05 | Task staged | PROMPT.md + STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
