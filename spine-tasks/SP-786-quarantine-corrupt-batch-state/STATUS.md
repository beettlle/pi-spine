# SP-786: Quarantine corrupt batch-state instead of deleting it — Status

**Current Step:** Step 4 (Testing & Verification)
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
**Status:** ✅ Complete

- [x] Rename-to-quarantine
- [x] `.pi` never modified
- [x] Lock + `projectRoot` threading
- [x] `lifecycle.mjs` ≤ 500 lines (469)

### Step 2: Fail-closed start
**Status:** ✅ Complete

- [x] Actionable throw on corrupt
- [x] Holds with `skipPreflight` (engine.mjs:98 calls `assertNoActiveBatch` unconditionally; test proves rejection)

### Step 3: Tests
**Status:** ✅ Complete

- [x] Corrupt `.spine` quarantined (both functions)
- [x] `.pi` untouched (corrupt + terminal)
- [x] Start refuses (skipPreflight: true → rejects with quarantine message)

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
| 6 | `clearActiveBatchStateIfMatches` gained optional 3rd `projectRoot` param (derived from `.spine` parent when omitted) — existing 2-arg test call sites stay compatible |
| 7 | Corrupt `.pi` + `assertNoActiveBatch` now throws a "left unmodified by spine" report (mission: "a corrupt `.pi` file is reported, not modified"); start previously would have thrown for active `.pi` only, silently passing corrupt ones under `--skip-preflight` |
| 8 | ENOENT guard added in both corrupt branches: file vanishing between `existsSync` and lock acquisition returns `{reason:"missing"}` instead of crashing `renameSync` |

## Blockers

_None._
