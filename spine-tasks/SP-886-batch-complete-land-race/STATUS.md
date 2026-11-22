# SP-886: Fix batch complete vs land-loop finalize race — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress — Step 2 Testing & Verification
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
**Status:** ⬜ Not Started

- [ ] Wait/retry or pending diagnosis for finalize race
- [ ] Preserve fail-closed for true state changes
- [ ] Keep journal observability

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Regression coverage
- [ ] Contract testCommand passing

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook updated
- [ ] Discoveries logged
- [ ] Create `.DONE`

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

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #379 (#371 regression).
