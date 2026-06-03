# SP-082: orphan running reconciliation — Status

**Status:** 🟢 Complete
**Last Updated:** 2026-06-03

## Progress

- [x] Step 0: Preflight — orphan without dead PIDs still reports `running`; dead PIDs yield actionable diagnosis
- [x] Step 1: `isProcessAlive`, `resilience.enginePid` persistence, clear on terminal save
- [x] Step 2: Orphan detection in reconcile → `needs_retry` (dead worker) / `engine_orphaned` (dead engine)
- [x] Step 3: Unit tests + coverage ≥77% (81.2%)
- [x] Step 4: PRD §17.5/FR-BATCH-13, operator runbook orphan section

## Discoveries

- `saveSpineBatchState` clears `enginePid` on terminal phases so completed batches do not retain stale engine records.
- Dead lane `workerPid` takes precedence over dead `enginePid` in orphan detection (returns `needs_retry` with retry command).
- Batches without recorded PIDs still diagnose as `running` — liveness checks only apply when PIDs are present.
