# SP-861: pause-retry stale_engine_pid — Status

**Current Step:** Step 2 (Tests)
**Status:** 🔄 In Progress — Step 2
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
**Status:** ⬜ Not Started

- [ ] Pause+retry write; false vs true attached resume cases

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing
- [ ] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

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

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |

## Blockers

*None*
