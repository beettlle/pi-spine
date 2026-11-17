# SP-861: pause-retry stale_engine_pid — Status

**Current Step:** Complete
**Status:** ✅ Complete — all steps done
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `evaluateBatchStateWriteGuard`, attached-resume refuse path; report blast radius
- [x] `rg -n "stale_engine_pid|Attached batch engine already running" src/ tests/`

### Step 1: Guard + resume ownership
**Status:** ✅ Complete

- [x] Pause+retry persists without false `stale_engine_pid`
- [x] Detached resume not blocked by false attached ownership; true live engine still refuses

### Step 2: Tests
**Status:** ✅ Complete

- [x] Pause+retry write; false vs true attached resume cases

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing
- [x] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `evaluateBatchStateWriteGuard` blast radius CRITICAL (348 symbols / 151 processes / 18 modules) — mitigation: deny-by-default kept; only narrow live-owner refusal for on-disk phase `paused` (pause = ownership handoff) | acknowledged | Step 0 |
| `batch.paused` journal lands AFTER `engine.pause_observed` (pauseBatch journals at the end, after confirmation). Acknowledgement discriminator = last `engine.pause_observed` index > last `batch.resumed` index | design input | Step 0 |
| All pinned `stale_engine_pid` test refusals use running on-disk phase → paused-phase guard narrowing keeps them green; unacknowledged live-PID resume refusals (`attached-engine-lock`, `resume-single-owner`) keep refusing because tests journal no `engine.pause_observed` | design input | Step 0 |
| Retry's persisted save clears enginePid (terminal `failed` phase → `clearBatchEnginePid` in `persistSpineBatchStateGuarded`), so pause→retry→resume is unblocked once the guard allows the retry write | design input | Step 0 |
| Guard narrowing keys on ON-DISK phase (`paused`), not incoming phase — all pinned `stale_engine_pid` refusals (`batch-state-update`, SP-793 gate-reopen) seed running disk phase, so they stay green | implementation | Step 1 |
| `retryTask` on a paused batch with the last failed task **unblocks** (phase stays `paused`; enginePid stays recorded because paused is non-terminal) — detached resume after pause+retry therefore relies on the acknowledged-pause allow in `enforceAttachedEngineSingleOwner`; the two changes compose and are both required | implementation | Step 2 |
| Runbook for this class is already correct: SP-857 (landed) documents "SP-861 clears the `stale_engine_pid` ownership instead of blocking" — matches this implementation; no doc edits needed here (runbook owned by SP-857) | docs | Step 4 |

### Verification evidence

- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- Contract test files (`--test`): 36/36 pass, 0 fail
- Wider regression sweep (pause/resume/retry/orphan/batch-state/attached/detached/lifecycle/reconcile suites): 367/367 pass, 0 fail

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
