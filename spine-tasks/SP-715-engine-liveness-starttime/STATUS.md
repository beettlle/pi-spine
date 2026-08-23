# SP-715: Engine liveness pairs PID with engineStartedAt — Status

**Current Step:** Step 1: Paired liveness helper
**Status:** In Progress
**Last Updated:** 2026-08-23
**Review Level:** 1
**Size:** S

---

## Step 1: Paired liveness helper

**Status:** In Progress

**Plan (Review Level 1):** Add `isEngineProcessAlive(pid, expectedStartedAt, options)` in `src/process/liveness.mjs` with injectable `probeStartTimeMs`/`isAlive`/`platform`/`toleranceMs` for tests. Probe: Linux `/proc/<pid>/starttime` (field 22 of stat, parsed after last `)`; converted via `/proc/stat` btime + `getconf CLK_TCK`), macOS/other `ps -p <pid> -o lstart=` parsed with fixed `Www Mmm dd hh:mm:ss yyyy` parser under `LC_ALL=C`. Windows: PID-only fallback with code comment documenting the limitation (SP-715 / #259). Missing/unavailable probe or missing `engineStartedAt` also falls back to PID-only (fail-open preserves current behavior when start time is unknowable); mismatch beyond tolerance → not alive.

## Step 2: Wire engine ownership checks

**Status:** Not Started

## Step 3: Testing & Verification

**Status:** Not Started

## Step 4: Documentation & Delivery

**Status:** Not Started

---

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | v2.15.0 release packet |
