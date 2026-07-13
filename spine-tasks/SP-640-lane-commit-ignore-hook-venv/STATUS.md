# SP-640: Lane commit ignore hook .venv — Status

**Current Step:** Step 3 — Documentation & Delivery (hygiene .DONE)
**Status:** ✅ Complete
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
**Status:** ✅ Complete
- [x] Contract
- [x] Full suite
- [x] Coverage ≥77%

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [x] Template default if needed
- [x] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `worktreeSetupIgnorePaths` only filtered post-commit dirty porcelain; `commitLaneWorktree` staged all dirty paths | Pass ignorePatterns + fileScope into staging; skip unless in fileScope |
| Template shipped `[]`; unset resolved to `[]` | `resolveWorktreeSetupIgnorePaths` unions `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`; template → `[".venv"]` |
| GitNexus CRITICAL on commit/filter/loadSpineConfig | Additive filter + defaults only |

## Completion Criteria

- [x] Hook `.venv` not committed by lane completion
- [x] #200 closable

## Blockers

_None yet._


## Hygiene note

 created on main 2026-07-13 after salvaged land of implementation commits (dogfood #201/#203). No re-implementation.
