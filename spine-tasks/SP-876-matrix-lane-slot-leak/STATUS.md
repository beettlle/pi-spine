# SP-876: Matrix: release lane slot if state save throws; do not swallow packet load errors — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
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
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Fresh-run call site `runTaskOnLane` (src/batch/engine-lanes.mjs:128) has the same `loadMatrixTaskRows` null → plain-worker fallback but is **outside File Scope**; the fail-closed fix covers the in-scope `runMatrixTaskForResume` (resume.mjs / resume-multi-lanes.mjs). | Out of scope — needs follow-up SP task | src/batch/engine-lanes.mjs |
| `loadMatrixTaskRows` collapse point is `catch { return null }` in src/batch/engine-lanes/matrix.mjs (also out of scope); fix implemented at the in-scope call site by re-loading the packet via `loadTaskPacket` + `parsePrompt(raw).sections.Matrix` detection. | Documented | src/batch/engine-lanes/matrix.mjs |
| Slot-leak test arms a state entry whose `exitCode` getter throws once the `running` status flip fires — deterministic save failure in the exact formerly-unguarded window, no mocks (mock.module unavailable under contract test flags). | Test technique | tests/batch/matrix-run.test.mjs |
| Mutation-verified: leak test times out (30s bound) on pre-fix code (row b deadlocks on the leaked slot); packet fail-closed test rejects /matrix packet failed to load/ on pre-fix code. Both pass on fixed code. | Regression guard evidence | tests/batch/matrix-run.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|----------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | acquire + save before try confirmed in runMatrixTaskOnLane row callback; loadMatrixTaskRows `catch → null` confirmed at matrix.mjs:44-49; call sites matrix-run.mjs (in scope) and engine-lanes.mjs:128 (out of scope) |
| 2026-11-20 | Step 1 implemented | per-row save moved inside try so releaseLaneSlot always runs after acquire; assertMatrixPacketLoaded fails closed for declared-matrix broken packets in runMatrixTaskForResume; GitNexus impact UNKNOWN (stale index) → callers confirmed by text search (resume.mjs, resume-multi-lanes.mjs, engine-lanes.mjs) |
| 2026-11-20 | Step 2 tests | 4 tests in tests/batch/matrix-run.test.mjs (slot release on save throw; broken matrix packet fail-closed; plain unchanged; broken plain unchanged) — all pass; mutation-checked against pre-fix src, both guards fail as expected |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
