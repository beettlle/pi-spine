# SP-635: Resume eligibility terminal class — Status

**Current Step:** Step 3 — Documentation & Delivery (hygiene .DONE)
**Status:** ✅ Complete
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Reproduce #197 path
- [x] Trace eligibility vs diagnose

### Step 1: Align eligibility with terminal classification
**Status:** ✅ Complete
- [x] Treat terminal-success for force-resume
- [x] No pause required for #197
- [x] Fail-closed for real running workers

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Regression for #197
- [x] Contract testCommand
- [x] Full suite
- [x] Coverage ≥77%

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [x] Create .DONE

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `allTasksTerminalSuccessForResume` only accepts `status===succeeded\|skipped`; diagnose uses classification/doneInLane (#197) | Align with salvage `isTerminalSuccessTask` |
| `hasPendingWaveMerge`/`waveTasksAllTerminal` also status-only — blocks pidless path even after terminal fix | Add local `hasPendingWaveMergeForResume` in resume-multi-validate (do not touch out-of-scope wave-merge-state; HIGH blast radius) |
| Real-pi worker; `spine_review_step` skipped | Engine owns plan/code/final review after `.DONE` |
| Impact `allTasksTerminalSuccessForResume`: LOW | Proceed |
| Contract tests: 14 pass, 0 fail | Proceed to full suite + coverage |

## Completion Criteria

- [x] `resume --force` works for #197 without prior pause
- [x] Regression test covers status=running + terminal-success classification

## Blockers

_None yet._


## Hygiene note

 created on main 2026-07-13 after salvaged land of implementation commits (dogfood #201/#203). No re-implementation.
