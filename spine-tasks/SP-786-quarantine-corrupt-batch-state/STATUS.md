# SP-786: Quarantine corrupt batch-state instead of deleting it — Status

**Current Step:** Step 1 (Quarantine + spine-only path + lock)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce deletions
- [x] List callers/tests
- [x] Confirm unconditional `assertNoActiveBatch`
- [x] Dependencies satisfied

### Step 1: Quarantine + spine-only path + lock
**Status:** ⬜ Not Started

- [ ] Rename-to-quarantine
- [ ] `.pi` never modified
- [ ] Lock + `projectRoot` threading
- [ ] `lifecycle.mjs` ≤ 500 lines

### Step 2: Fail-closed start
**Status:** ⬜ Not Started

- [ ] Actionable throw on corrupt
- [ ] Holds with `skipPreflight`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Corrupt `.spine` quarantined
- [ ] `.pi` untouched
- [ ] Start refuses

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Reproduced all #303 deletions in temp project: `clearStaleTerminalBatchStateForStart` deletes corrupt `.spine` state (`{cleared:true,reason:"corrupt"}`, file gone); `clearActiveBatchStateIfMatches` silently deletes corrupt active state; corrupt `.pi/batch-state.json` deleted via `resolveBatchStatePath` fallback; even a *valid terminal* `.pi` file is deleted (`{cleared:true,reason:"stale_terminal"}`) |
| 2 | Callers: `clearActiveBatchStateIfMatches` ← `lifecycle-archive.mjs:45` + handoff test (2-arg); `clearStaleTerminalBatchStateForStart` ← `state.mjs:131` + handoff test; `clearCompletedBatchState` ← `lifecycle.mjs:250,456` (both already inside `withBatchStateLock` sections — re-entrant lock makes nested acquisition safe) |
| 3 | `engine.mjs:98` calls `assertNoActiveBatch(projectRoot)` unconditionally, outside the `if (!skipPreflight)` block — fail-closed throw in `assertNoActiveBatch` holds for `skipPreflight: true` |
| 4 | `abort.mjs:81` has its own local `clearActiveBatchState` (plain unlink of `loaded.path`) — outside File Scope, left as-is (could quarantine in a follow-up) |
| 5 | Preflight `checkNoActiveBatch` (git-batch.mjs:214) reports parse errors read-only via `resolveBatchStatePath` — keep `.pi` fallback for reads; only clear/start mutation paths become spine-only |

## Blockers

_None._
