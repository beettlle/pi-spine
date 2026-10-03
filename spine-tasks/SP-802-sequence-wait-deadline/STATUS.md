# SP-802: Sequence wait deadline — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] Max-wait + stall keys

### Step 2: Wait loop + liveness + caller
**Status:** ✅ Complete

- [x] Hard cap
- [x] Stall exit
- [x] Start-time liveness
- [x] Caller surfaces results

### Step 3: Tests
**Status:** ✅ Complete

- [x] Stalled engine
- [x] Max wait
- [x] PID reuse
- [x] Existing test green

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `npm run lint` clean
- [x] Contract `testCommand` — lint + typecheck + 164/164 tests pass
- [x] Full suite — 2769/2769 pass (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm test`)
- [x] Coverage gate — 90.00% line coverage (threshold 77%), 2769/2769
- [x] Fix all failures — first coverage attempt failed 44 tests because `SPINE_IS_WORKER=1` leaked from the worker env; re-run with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` is green (environmental, not code)

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `src/config/defaults.mjs` needs no edit: it only re-exports `ORCHESTRATOR_DEFAULTS` from `spine-config-schema.mjs` via `CONFIG_V2_SECTION_DEFAULTS`, so the new keys flow through automatically. |
| 2 | `reconcileBatch({ light: true })` still parses the journal fully (light mode only skips git branch scans), so `signals.journalEvents` is a reliable per-poll progress signal; `lane.heartbeat` events are covered by the newest journal timestamp. |
| 3 | The existing poll-key validator clamps to `MIN/MAX_ORCHESTRATOR_POLL_MS` (100–60000), which would reject the 24 h max-wait default; a separate positive-integer validator (`validatePositiveDurationMs`) was added for `sequenceMaxWaitMs`/`sequenceStallMs`. |
| 4 | `docs/adoption/operator-runbook.md` mentions `sequencePollMs` only; unchanged behavior, and SP-803 owns documenting the new keys — no doc edit in this task. |
| 5 | `npm run coverage:check` inherits the worker env; with `SPINE_IS_WORKER=1` set, 44 tests fail on `nested_batch_spawn_blocked`. Must run with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` (matches PROMPT Environment note). |

## Blockers

_None._
