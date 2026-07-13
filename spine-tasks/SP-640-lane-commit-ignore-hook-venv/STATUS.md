# SP-640: Lane commit ignore hook .venv — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Trace ignorePaths to lane commit
- [x] Confirm .venv can stage today

### Step 1: Default ignore + commit filter
**Status:** ✅ Complete
- [x] Default includes .venv
- [x] Skip ignored paths on commit
- [x] Regression

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [ ] Contract
- [ ] Full suite
- [ ] Coverage ≥77%

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Template default if needed
- [ ] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `worktreeSetupIgnorePaths` only filtered post-commit dirty porcelain; `commitLaneWorktree` staged all dirty paths | Pass ignorePatterns + fileScope into staging; skip unless in fileScope |
| Template shipped `[]`; unset resolved to `[]` | `resolveWorktreeSetupIgnorePaths` unions `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`; template → `[".venv"]` |
| GitNexus CRITICAL on commit/filter/loadSpineConfig | Additive filter + defaults only |

## Completion Criteria

- [x] Hook `.venv` not committed by lane completion
- [ ] #200 closable

## Blockers

_None yet._
