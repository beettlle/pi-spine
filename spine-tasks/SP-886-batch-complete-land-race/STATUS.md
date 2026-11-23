# SP-886: Fix batch complete vs land-loop finalize race — Status

**Current Step:** Complete
**Status:** ✅ Complete — awaiting engine review
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Dependencies satisfied (SP-885)
- [x] Reproduce failure mode from #379 / late-finalize tests
- [x] Map complete → reloadStateForTerminalWrite

**Step 0 notes:**

- Root cause (#379): `finalizeBatchForIntegrate` (post-merge-limbo.mjs) clears the engine PID and saves **before** writing `phase: "completed"` (#198, so hung evidence cannot block complete). Disk window: active phase + no recorded PID.
- In that window `completeBatch` passes all pre-lock checks (reconcile allSuccess+mergeSatisfied; no alive PID), then the in-lock `reloadStateForTerminalWrite` sees active phase; the #371 pending branch requires a **live recorded PID** — the cleared PID fails `isLiveEngineInActivePhase` → hard `batch_state_changed_during_terminal_write`. Second complete succeeds once finalize persists `phase: "completed"`.
- Reproduction: new regression in tests/batch/batch-complete-engine.test.mjs fails on unfixed code (`pending: undefined`, hard refusal asserted).
- Distinction preserved: recorded-but-dead PID (#371 crash signature) stays a hard refusal; PID **absent** + `gate.approved`/`integrate.completed` journaled (finalize signature; batch cannot start new work past approval) becomes the pending wait.

---

### Step 1: Eliminate false-hard failure
**Status:** ✅ Complete

- [x] Wait/retry or pending diagnosis for finalize race
- [x] Preserve fail-closed for true state changes
- [x] Keep journal observability

Pending-wait diagnosis chosen (mission option 3): `src/batch/lifecycle-archive.mjs` — new `journalHasIntegrateProgressSignals` (gate.approved / integrate.completed journaled); `reloadStateForTerminalWrite` returns the soft `engine_finishing_land_loop` pending wait (same shape as #371) when phase is active, the PID is **absent** (finalize's #198 PID-clear signature), and finalize-window signals exist. Injected `deps.isFinalizeInFlight` overrides. Recorded-but-dead PID still hard-refuses (#371 crash signature); PID-less active state with NO approval signals (paused / resumed-for-real-work) still hard-refuses; `batch.late_finalize_skipped` (#293) untouched.

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Regression coverage
- [x] Contract testCommand passing

6 regressions added: e2e #379 (first complete pending → finalize lands → second complete archives) and 4 reload unit tests in tests/batch/batch-complete-engine.test.mjs; cross-module #379 in tests/batch/late-finalize-after-complete.test.mjs (real gate approve + integrate; asserts `batch.late_finalize_skipped` NOT journaled for this ordering). Contract `testCommand` exit 0: lint clean, typecheck clean, 17/17 targeted tests.

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook updated
- [x] Discoveries logged
- [x] Create `.DONE`

`docs/adoption/operator-runbook.md` §4 Land loop: "First complete after integrate (#379)" note — pending wait output, wait command, retry-succeeds guidance, and when `batch_state_changed_during_terminal_write` after integrate still means a real change (links to Agent-safe state_drift recovery #196). `skills/spine-release-operator/SKILL.md` §4.3 checked — NOT affected (documents the same approve → integrate → complete sequence; outside File Scope, no edit).

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-22 | Step 0 | Root cause mapped (#198 PID-clear finalize window), #379 reproduced via failing regression |
| 2026-11-22 | Step 1 | Pending-wait finalize-window branch in lifecycle-archive.mjs; fail-closed cases preserved |
| 2026-11-22 | Step 2 | 6 regressions green; Contract testCommand exit 0 |
| 2026-11-22 | Step 3 | Runbook §4 note added; SKILL §4.3 checked unaffected; `.DONE` created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #379 (#371 regression).
