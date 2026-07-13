# SP-645: Diagnose salvage pending lane — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** ✅ Complete
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-644 refuse behavior on disk
- [x] Map salvage CLI flags

### Step 1: Salvage suggestion for pending lane
**Status:** ✅ Complete
- [x] Detect pending-land signals
- [x] suggestedCommand → salvage integrate
- [x] Do not primary-recommend batch complete

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Regression
- [x] Contract testCommand
- [x] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-644 already exports salvage integrate shape via `buildPendingLaneLandSuggestedCommand` in lifecycle | Reused same command shape in diagnosis helpers |
| Pending lane land must not fire during active `needs_merge` | Gate on `allTasksTerminalSuccess` + merge satisfied, or `stateDrift.drifted` |

## Completion Criteria

- [x] See PROMPT Completion Criteria

## Blockers

_None._
