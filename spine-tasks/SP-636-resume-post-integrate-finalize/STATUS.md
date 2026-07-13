# SP-636: Resume post-integrate finalize — Status

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
- [x] Trace #198 missing finalize
- [x] Locate resume vs healthy path

### Step 1: Finalize / exit resume engine
**Status:** ✅ Complete
- [x] Emit land_loop_finalized / exit
- [x] batch complete not blocked after finalize
- [x] No hand-edit batch-state

### Step 2: Testing & Verification
**Status:** 🔄 In Progress
- [x] Regression
- [x] Contract
- [ ] Full suite
- [ ] Coverage ≥77%

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `finalizeBatchForIntegrate` opens gate (runs extended evidence / often `npm test`) before `batch.completed`, `clearBatchEnginePid`, and `batch.land_loop_finalized` | Clear PID before gate open; idempotent `ensureLandLoopFinalizedAfterGateOrIntegrate` after gate exists; keep `gate.opened` before `batch.completed` |
| `finalizeAttachedLandLoopBeforeExit` returned `already_finalized` when gate exists without clearing PID or writing `land_loop_finalized` | Call ensure on that path |
| Host `integrate.completed` while resume engine stuck in evidence leaves zombie PID | Attached milestone loop ensures finalize and exits on integrate/approved gate |
| Healthy detached path already finalizes via `finalizeBatchForIntegrate` after last merge | Resume path shares ensure semantics |

## Completion Criteria

- [x] Resume path emits land-loop finalize / exits after merge+gate
- [x] Regression covers finalize presence

## Blockers

_None yet._
