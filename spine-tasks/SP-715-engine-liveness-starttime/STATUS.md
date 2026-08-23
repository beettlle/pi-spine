# SP-715: Engine liveness pairs PID with engineStartedAt — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** Complete
**Last Updated:** 2026-08-23
**Review Level:** 1
**Size:** S

---

## Step 1: Paired liveness helper

**Status:** Complete

- [x] `isEngineProcessAlive(pid, expectedStartedAt, options)` added in `src/process/liveness.mjs` with injectable `isAlive` / `probeStartTimeMs` / `platform` / `toleranceMs`
- [x] macOS: `ps -p <pid> -o lstart=` parsed with fixed `Www Mmm dd hh:mm:ss yyyy` parser (`LC_ALL=C`); Linux: `/proc/<pid>/starttime` (field 22 after last `)`) converted via `/proc/stat` btime + `getconf CLK_TCK`, `ps` fallback
- [x] Windows: PID-only fallback with code comment documenting the recycled-PID limitation; missing `engineStartedAt` or unavailable probe also falls back to PID-only

## Step 2: Wire engine ownership checks

**Status:** Complete

- [x] `evaluateBatchStateWriteGuard` (`src/batch/state-guards.mjs`) uses `isEngineProcessAlive(ownerPid, readBatchEngineStartedAt(onDisk))` for both the terminal-state overwrite and `stale_engine_pid` checks
- [x] `reconcileOrphanRunningState` (`src/batch/reconcile-orphan.mjs`) clears `enginePid` via paired liveness
- [x] Added `readBatchEngineStartedAt(raw)` export (resilience + top-level fallback)
- [x] Out-of-file-scope engine callers (`orphan-detect.mjs`, `resume-engine.mjs`, `pause.mjs`, `batch-state-io.mjs`, etc.) left on PID-only per File Scope; noted in Discoveries

## Step 3: Testing & Verification

**Status:** Complete

- [x] PID-reuse mismatch tests (both directions), dead PID, missing start time, Windows fallback, probe-unavailable fallback, custom tolerance, real-probe self test
- [x] Write-guard integration tests: live matching engine blocks (`stale_engine_pid`); reused PID (mismatched start time) does not block
- [x] Contract `testCommand` run: `npm run typecheck` clean; `tests/batch/engine-liveness-starttime.test.mjs` + `tests/batch/orphan-dead-engine.test.mjs` → 19/19 pass
- [x] Regression sweep: batch-state-stale-writer, orphan-reconcile, engine-orphan-resume, batch-complete-engine, diagnosis-orphan-taxonomy → 33/33 pass

## Step 4: Documentation & Delivery

**Status:** Complete

- [x] `docs/adoption/operator-runbook.md` — PID-reuse-safe engine liveness note incl. Windows PID-only limitation
- [x] `.DONE` created

---

## Discoveries

| Date | Finding | Resolution |
|------|---------|------------|
| 2026-08-23 | `evaluateBatchStateWriteGuard` skips `ownerPid === process.pid`, so guard tests must spawn a child process as owner (mirrors `batch-state-stale-writer.test.mjs`) | Tests spawn `node -e setInterval` child |
| 2026-08-23 | Other engine-liveness callers (`orphan-detect.mjs`, `resume-engine.mjs`, `pause.mjs`, `batch-state-io.mjs`, `attached-runner-reconcile.mjs`, `sequence-wait.mjs`, `parent-session-monitor.mjs`, `resume-multi-validate.mjs`, `reconcile-batch.mjs`) still PID-only | Out of File Scope for SP-715; `isEngineProcessAlive` is exported for follow-up wiring |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | v2.15.0 release packet |
| 2026-08-23 | Step 1-2 complete | Paired liveness helper + state-guards/reconcile-orphan wiring; commit `fix(SP-715): complete Steps 1-2` |
| 2026-08-23 | Plan review | In-worker review skipped (real-pi session, SP-195); engine runs reviews after `.DONE` |
| 2026-08-23 | Step 3 complete | Contract testCommand green (typecheck + 19/19); regression sweep 33/33 |
| 2026-08-23 | Step 4 complete | Runbook updated; `.DONE` created — Closes #259 |
