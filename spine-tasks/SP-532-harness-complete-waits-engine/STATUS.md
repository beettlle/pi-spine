# SP-532: Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-07
**Review Level:** see PROMPT
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #173 reproduction: complete archives while next-wave engine runs
- [x] Trace `completeBatch` → `archiveBatchState` path

### Step 1: Engine-alive guard
**Status:** ✅ Complete

- [x] Before archive in `completeBatch`, check `readBatchEnginePid` + `isProcessAlive`
- [x] Return `ok: false` with diagnosis hint `engine_still_running` and `suggestedCommand: spine wait --until completed,failed,needs_integrate --timeout 2h`

### Step 2: Regression tests
**Status:** ✅ Complete

- [x] `tests/batch/batch-complete-engine.test.mjs`: complete refused when engine PID alive; allowed when dead/null

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract `testCommand`
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Comment on #173
- [x] Create `.DONE`

---

## Blockers

*None*
