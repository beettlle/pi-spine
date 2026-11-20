# SP-879: Worker: pi --mode json usage into task metric fields — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-878 API
- [x] Trace worker → recordLaneTaskMetric path

---

### Step 1: Worker JSON + attach usage
**Status:** ✅ Complete

- [x] --mode json
- [x] Parse + set task usage before metric

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Mock/fixture stdout → tokens on task record
- [x] Stub omits fields

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Sidecar transport: runner is a separate process; usage travels via `worker-usage.json` in the task packet folder, written on every real-pi terminal path when the SP-878 parser reports a counter | Implemented | `bin/spine-worker-runner.mjs` |
| Stale-sidecar hygiene: cleared before each pi spawn and in stub mode, so stub retries never inherit a prior attempt's costs | Implemented | `bin/spine-worker-runner.mjs` |
| Engine attach via `attachTaskUsageFromSidecar` inside `recordLaneTaskMetric` — single funnel covers success/failure/matrix/commit callers with no out-of-scope edits | Implemented | `src/batch/engine-lanes/queue.mjs` |
| Skip-gate: success-path metrics record after lane commit (sidecar legitimately rides the commit); skipped outcomes never attach a stale committed sidecar | Implemented | `src/batch/engine-lanes/queue.mjs` |
| Failure-path persistence deviates from "after successful pi run" — real spend happens on done-missing/non-zero exits; parser never invents values (flagged for plan review) | Deliberate | `bin/spine-worker-runner.mjs` |
| `--mode json` inserted after `--no-session` keeps existing `piArgs[0..2]` + tail-prompt assertions green | Verified | `tests/agents/worker-runner.test.mjs` et al. |
| `worker-usage.json` filename constant duplicated runner/queue (File Scope excludes a shared module); sync comments + e2e tests pin it | Accepted | both files |
| Batch-spawning tests need `SPINE_IS_WORKER` unset (SP-482 guard), per PROMPT Environment note | Documented | STATUS Verification |
| Accidental stash-pop conflict-marked AGENTS.md/CLAUDE.md (old operator stash); restored from HEAD, zero net change, operator stash preserved | Resolved | git history |

---

## Verification

- Contract `testCommand` (exact): `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-usage-metrics.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` → **exit 0** (eslint clean at `--max-warnings 0`, both tsconfig projects clean, 16/16 tests pass).
- Regression check: `tests/agents/worker-runner.test.mjs`, `tests/batch/worker-runner-done-missing.test.mjs`, `tests/batch/worker-model-pin.test.mjs`, `tests/batch/worker-host-contract.test.mjs` — 33 subtests pass with `SPINE_IS_WORKER` unset.

## Documentation Check

- `docs/adoption/operator-runbook.md`: **not affected** — documents run-metrics mechanics/enabled flag, never enumerates worker usage fields; no operator-facing config or workflow changed. "Must Update: None" honored.

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-20 | Step 0 preflight: SP-878 API + worker→metric path traced | Done |
| 2026-11-20 | Steps 1–2: `--mode json`, sidecar producer, engine attach, 7 new tests | Committed 98a28647 |
| 2026-11-20 | Step 3: Contract testCommand | Exit 0 |
| 2026-11-20 | Step 4: STATUS finalized, .DONE created | Done |
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
