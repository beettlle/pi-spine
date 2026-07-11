# SP-613: Drift detached recover — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-11
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Reproduce #196 dead-engine drift path
- [x] Trace resume rejection + suggestedCommand

### Step 1: Detached reconcile / resume path

**Status:** ✅ Complete

- [x] Detached recovery to needs_integrate / gate-ready
- [x] No `--attached` requirement
- [x] suggestedCommand agent-safe

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Regression tests
- [x] Contract testCommand
- [x] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Notes

### Verification evidence

- Contract: `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/engine-orphan-resume.test.mjs tests/batch/resume-orphan-recovery.test.mjs` → 13/13 pass
- Full suite (unset `SPINE_IS_WORKER` nest guard): 1979 pass, 0 fail
- Coverage: **89.02%** line (threshold 77%) PASS

### Fix summary

Pidless + all tasks terminal-success + pending wave merge is now resume-eligible; `suggestedCommand` prefers detached `spine batch resume --force` for state_drift / terminal engine_orphaned / needs_merge (no `--attached`).

## Discoveries

| Finding | Action |
|---------|--------|
| PID-cleared + all succeeded + pending merge → `cannot_resume` / phase running | Extended eligibility for pidless terminal-success pending merge |
| Dead PID + healed tasks → `engine_orphaned` suggests `--attached` | Prefer detached `resume --force` when allTasksTerminalSuccess |
| Full suite under `SPINE_IS_WORKER=1` blocks nested startBatch | Re-run suite with nest env unset (worker harness artifact) |
| Task IDs with letter suffix fail PROMPT heading regex | Use numeric `SP-613` / `SP-614` in fixtures |
