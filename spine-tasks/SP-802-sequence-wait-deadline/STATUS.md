# SP-802: Sequence wait deadline — Status

**Current Step:** Step 1: Config keys
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Progress timestamps identified
- [x] Callers/assertions listed
- [x] Dependencies satisfied

**Notes:**
- Progress signals available without new state fields: `reconciliation.signals.raw.updatedAt` (epoch ms) and `reconciliation.signals.journalEvents` (full parse even in light mode; `lane.heartbeat` events are journal events, so the newest journal `timestamp` covers lane heartbeats).
- Callers: `runSequence` (`src/batch/sequence-run.mjs` ~337) only; `timeout_waiting_for_batch` also asserted in `tests/batch/detached-start-orphan-timeout.test.mjs` and produced by `src/batch/detached-wait.mjs` (different loop — untouched).
- SP-798 merged (`c0a7113e`); `src/config/defaults.mjs` only re-exports `ORCHESTRATOR_DEFAULTS` from the schema module, so new keys flow through `CONFIG_V2_SECTION_DEFAULTS` with no edit there.

**Plan (Level 1):**
1. Schema: `DEFAULT_SEQUENCE_MAX_WAIT_MS` (24h), `DEFAULT_SEQUENCE_STALL_MS` (30min), both added to `ORCHESTRATOR_DEFAULTS`; positive-integer validation (no poll-range clamp — 24h exceeds `MAX_ORCHESTRATOR_POLL_MS`); `resolveSequenceMaxWaitMs` / `resolveSequenceStallMs` resolvers.
2. `waitForSequenceBatchTerminal`: `maxWaitMs`/`stallMs` params; hard-cap check → `sequence_wait_timeout` (+`suggestedCommand: "spine status --diagnose"`); per-poll progress tracking (`max(updatedAt, last journal event ts)`) → `engine_stalled` after `stallMs` without progress; `isEngineStillRunning` via `readBatchEnginePid`/`readBatchEngineStartedAt`/`isEngineProcessAlive`, explicit-PID paired with state start time on PID match, `isProcessAlive` fallback otherwise; dead `raw?.enginePid` read removed.
3. Caller resolves config values, passes them, surfaces `suggestedCommand` in halt extra.
4. Tests: stalled engine, max-wait cap, PID-reuse start-time mismatch, existing extend-while-progressing.

### Step 1: Config keys
**Status:** ⬜ Not Started

- [ ] Max-wait + stall keys

### Step 2: Wait loop + liveness + caller
**Status:** ⬜ Not Started

- [ ] Hard cap
- [ ] Stall exit
- [ ] Start-time liveness
- [ ] Caller surfaces results

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Stalled engine
- [ ] Max wait
- [ ] PID reuse
- [ ] Existing test green

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Full suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|

## Blockers

_None._
