# SP-613: Drift detached recover — Status

**Current Step:** Step 0
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-11
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** 🔄 In Progress

- [x] Reproduce #196 dead-engine drift path
- [x] Trace resume rejection + suggestedCommand

### Step 1: Detached reconcile / resume path

**Status:** ⬜ Not Started

- [ ] Detached recovery to needs_integrate / gate-ready
- [ ] No `--attached` requirement
- [ ] suggestedCommand agent-safe

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

**Fix (narrow, HIGH-risk symbols):**
1. `assessRunningPhaseResumeEligibility` — treat pidless + all tasks terminal-success + pending wave merge as engine-dead / orphan-resume eligible.
2. `buildSuggestedCommand` — `state_drift` always prefers detached `resume --force` when engine dead / phase running / terminal-success; `engine_orphaned` with allTasksTerminalSuccess → `resume --force` (not `--attached`).
3. Detached resume already spawns once validate passes; no attached requirement.
4. Regression in scoped test files covering dead/cleared PID + doneInLane + phase running.

## Discoveries

| Finding | Action |
|---------|--------|
| PID-cleared + all succeeded + pending merge → `cannot_resume` / phase running | Extend eligibility for pidless terminal-success pending merge |
| Dead PID + healed tasks → `engine_orphaned` suggests `--attached` | Prefer detached `resume --force` when allTasksTerminalSuccess |
| Force+dead PID already validates when PID present | Keep; fix suggestion only |
| Impact: assessRunningPhaseResumeEligibility / validateMultiTaskResume HIGH | Narrow predicate only |
