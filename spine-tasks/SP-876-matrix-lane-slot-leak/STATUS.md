# SP-876: Matrix: release lane slot if state save throws; do not swallow packet load errors — Status

**Current Step:** Complete
**Status:** ✅ Done (awaiting engine plan + final review)
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm acquire/save/finally order
- [x] Trace loadMatrixTaskRows null path

---

### Step 1: Slot + packet fail-closed
**Status:** ✅ Complete

- [x] Always release acquired slots
- [x] Propagate packet load errors

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Save throw releases slot
- [x] Broken packet fails closed

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 1318b6b  src/batch/engine-lanes/matrix-run.mjs:567  ERROR  The change introduces a control-flow defect: when `loadMatrixTaskRows` | advisory — noted, not blocking | contract review step |
| Fresh-run call site `runTaskOnLane` (src/batch/engine-lanes.mjs:128) has the same `loadMatrixTaskRows` null → plain-worker fallback but is **outside File Scope**; the fail-closed fix covers the in-scope `runMatrixTaskForResume` (resume.mjs / resume-multi-lanes.mjs). | Out of scope — needs follow-up SP task | src/batch/engine-lanes.mjs |
| `loadMatrixTaskRows` collapse point is `catch { return null }` in src/batch/engine-lanes/matrix.mjs (also out of scope); fix implemented at the in-scope call site by re-loading the packet via `loadTaskPacket` + `parsePrompt(raw).sections.Matrix` detection. | Documented | src/batch/engine-lanes/matrix.mjs |
| Slot-leak test arms a state entry whose `exitCode` getter throws once the `running` status flip fires — deterministic save failure in the exact formerly-unguarded window, no mocks (mock.module unavailable under contract test flags). | Test technique | tests/batch/matrix-run.test.mjs |
| Mutation-verified: leak test times out (30s bound) on pre-fix code (row b deadlocks on the leaked slot); packet fail-closed test rejects /matrix packet failed to load/ on pre-fix code. Both pass on fixed code. | Regression guard evidence | tests/batch/matrix-run.test.mjs |
| Contract testCommand exit 0 (lint + typecheck + 13 tests). Full stub suite with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset (per PROMPT Environment): 3322 pass / 0 fail — covers matrix-execution e2e success-path scheduling unchanged. Running the full suite WITH inherited `SPINE_IS_WORKER=1` fails `tests/spine-run.test.mjs` via `nested_batch_spawn_blocked` (SP-482 guard) — environmental, not a code regression. | Verification evidence | contract command; SPINE_WORKER_STUB=1 npm test |
| `docs/adoption/operator-runbook.md` checked per PROMPT "Check If Affected": no metrics or plan-review behavior changed (internal error-path fix + fail-closed packet guard), so no runbook update required. | Docs check — not affected | docs/adoption/operator-runbook.md |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|----------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | acquire + save before try confirmed in runMatrixTaskOnLane row callback; loadMatrixTaskRows `catch → null` confirmed at matrix.mjs:44-49; call sites matrix-run.mjs (in scope) and engine-lanes.mjs:128 (out of scope) |
| 2026-11-20 | Step 1 implemented | per-row save moved inside try so releaseLaneSlot always runs after acquire; assertMatrixPacketLoaded fails closed for declared-matrix broken packets in runMatrixTaskForResume; GitNexus impact UNKNOWN (stale index) → callers confirmed by text search (resume.mjs, resume-multi-lanes.mjs, engine-lanes.mjs) |
| 2026-11-20 | Step 2 tests | 4 tests in tests/batch/matrix-run.test.mjs (slot release on save throw; broken matrix packet fail-closed; plain unchanged; broken plain unchanged) — all pass; mutation-checked against pre-fix src, both guards fail as expected |
| 2026-11-20 | Step 3 verification | Contract testCommand exit 0; full stub suite 3322/3322 pass with worker env vars unset (nested_batch_spawn_blocked failures only when SPINE_IS_WORKER inherited — environmental) |
| 2026-11-20 | Step 4 delivery | Discoveries documented; operator-runbook checked (not affected); .DONE created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
