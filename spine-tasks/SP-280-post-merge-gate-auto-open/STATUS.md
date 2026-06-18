# Status: SP-280 — Post-merge integrate gate auto-open

**Task:** SP-280-post-merge-gate-auto-open
**Started:** 2026-06-17
**Completed:** 2026-06-17

## Progress

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Limbo conditions from issue #3 documented — `phase: running`, all tasks `succeeded`, `mergeResults` populated, no gate
- [x] Engine exit path traced — finalize ran only after full wave loop; last-wave merge left post-merge limbo if process exited before loop end

### Step 1: Auto-finalize on engine completion

**Status:** ✅ Complete

- [x] Shared finalize helper — `finalizeBatchForIntegrate` (wraps `finalizeResumedBatchForIntegrate`)
- [x] engine.mjs invokes on last-wave merge completion

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] post-merge-limbo tests extended
- [x] Full suite + coverage gate — `npm run typecheck` OK; 898/898 tests with `SPINE_WORKER_PI_TIMEOUT_MS` unset; coverage 86.81% (≥77%)

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] operator-runbook updated
- [x] Issue #3 closed
- [x] `.DONE` created

## Discoveries

| Finding | Impact |
|---------|--------|
| `finalizeBatchForIntegrate` must return `orchBranch` for `startBatch` callers | Fixed in return shape |
| Diagnosis suggests `gate approve` when gate exists during limbo | reconcile + diagnosis.mjs |
