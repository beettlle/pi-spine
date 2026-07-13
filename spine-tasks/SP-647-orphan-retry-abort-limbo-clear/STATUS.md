# SP-647: Orphan retry abort limbo clear — Status

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
- [x] Confirm SP-646 on disk
- [x] Trace retry blocked under dead engine — already unblocked via `reconcileOrphanRunningState` in `retryTask` (SP-315); SP-646 adds `engine_orphaned` classification

### Step 1: Clear limbo via retry/abort
**Status:** ✅ Complete
- [x] Retry/abort succeeds when engine dead
- [x] No hand-edit of .spine/runtime
- [x] Fail-closed when workers alive

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Regression (`tests/batch/orphan-retry-limbo.test.mjs`)
- [x] Contract testCommand
- [x] Fix scoped failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `retryTask` already calls `reconcileOrphanRunningState` before phase gate (SP-315) | SP-647 adds regression + extends same reconcile hook to `skipTask` |
| SP-646 `engine_orphaned` diagnosis matches working retry path for #203 multi-lane shape | No reconcile-diagnosis changes needed |
| `abortBatch` already archives running-phase dead-engine limbo without reconcile | Covered in regression |

## Completion Criteria

- [x] See PROMPT Completion Criteria

## Blockers

_None._
