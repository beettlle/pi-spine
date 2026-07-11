# SP-613: Drift detached recover — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
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

**Status:** 🔄 In Progress

- [x] Detached recovery to needs_integrate / gate-ready
- [x] No `--attached` requirement
- [x] suggestedCommand agent-safe

### Step 2: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Regression tests
- [ ] Contract testCommand
- [ ] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Plan (Step 0 → Step 1)

**Root cause (#196):** After doneInLane heal, tasks are `succeeded` while `phase=running`. If `enginePid` is cleared, `assessRunningPhaseResumeEligibility` reports `engineConfirmedDead=false` → `resume --force` dies with `Cannot resume batch in phase running`. If dead PID remains, diagnose is `engine_orphaned` with `suggestedCommand=spine batch resume --attached` (refused under #163 non-TTY).

**Fix applied:**
1. `assessRunningPhaseResumeEligibility` — pidless + all terminal-success + pending wave merge → engineConfirmedDead / allowOrphanResume
2. `buildSuggestedCommand` — state_drift / engine_orphaned(allTasksTerminalSuccess) / needs_merge → detached `spine batch resume --force`
3. Detached spawn path unchanged; validate gate unblocks it
4. Regressions in engine-orphan-resume + resume-orphan-recovery tests

## Discoveries

| Finding | Action |
|---------|--------|
| PID-cleared + all succeeded + pending merge → `cannot_resume` / phase running | Extended eligibility for pidless terminal-success pending merge |
| Dead PID + healed tasks → `engine_orphaned` suggests `--attached` | Prefer detached `resume --force` when allTasksTerminalSuccess |
| Force+dead PID already validates when PID present | Kept; fixed suggestion only |
| Impact: assessRunningPhaseResumeEligibility / validateMultiTaskResume HIGH | Narrowed predicate only |
