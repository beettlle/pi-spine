# SP-824: Gate streak reset failure fails closed — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete (2026-10-14)

- [x] Impact analysis recorded
- [x] Missing-file behavior confirmed
- [x] Dependencies satisfied

### Step 1: Journal and fail closed
**Status:** ✅ Complete (2026-10-14)

- [x] Journal both catches
- [x] `rmSync` fallback
- [x] `streakIo` seam

### Step 2: Block auto-approve
**Status:** ✅ Complete (2026-10-14)

- [x] `streak_unreliable`

### Step 3: Tests
**Status:** ✅ Complete (2026-10-14)

- [x] Four cases

### Step 4: Testing & Verification
**Status:** ✅ Complete (2026-10-14)

- [x] Lint
- [x] Contract `testCommand`
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact: `approveIntegrateGate` HIGH (2 direct callers: `maybeAutoApproveIntegrateGate`, `runSequenceWaveLandLoop`; 4 processes incl. salvage integrate) — ⚠️ HIGH risk noted; change only touches failure paths, happy-path bytes unchanged. `rejectIntegrateGate` LOW (0 indexed upstream). `maybeAutoApproveIntegrateGate` HIGH (5 impacted; callers `runSequenceWaveLandLoop`, `openGateFromSalvageEvidence`). |
| 2 | `loadGatePostureStreaks` (src/batch/gate-posture-streak.mjs:128-141) returns `emptyStreakState()` (all-zero counts) when file missing via `fs.existsSync` short-circuit; corrupt JSON also → zeros. So deleting the streak file is a valid fail-closed reset. |
| 3 | Journal event shape: `appendJournalEvent` stores options minus correlation/lane/task keys under `entry.payload` (src/batch/journal.mjs:154-197); readers use `readJournalEvents` (line 253) which returns `[]` for missing file. |
| 4 | `GatePostureEvaluateResult` = `{ decision, reason, tier }` with tier nullable ("null when no auto path matched") — synthesized `streak_unreliable` evaluation can use `tier: null`. |
| 5 | Gates always carry `kind: "integrate"` (src/batch/gate.mjs:124), so both category AND kind streak ops run on every approve/reject; the `streakIo` seam must cover both. |
| 6 | Journals are PER-BATCH (`.spine/runtime/<batchId>/journal/events.jsonl`, journal.mjs:60-62) while streak state is project-wide — so the `streak_unreliable` check must scan all project batch journals, not just the current batch's (caught by the cross-batch test case B). |
| 7 | Design note: an unrecovered-reset journal event blocks auto-approve indefinitely (no expiry) — fail-closed by design; manual approval remains the path forward since a later successful reset does not erase the historical event. |
| 8 | Contract LOC gate: `gate-posture-approve.mjs` is capped at 500 lines (batch-loc-policy, no grandfathering) — implementation compacted to 498 lines; any future additions to this file must budget LOC. |
| 9 | Stet triage (6 findings, all dismissed with evidence): `348bd12`/`f00ea66` (claimed `streakIo` ReferenceError in `approveIntegrateGate`/`maybeAutoApproveIntegrateGate`) are **stet reviewer bugs** — invented errors on stale hunks; `streakIo` is declared at lines 250/337/477 before use and tests exercise those exact paths green. `0fb67ff` (whole-file rmSync "overly destructive") — wrong_suggestion: PROMPT step 2 mandates `fs.rmSync(gatePostureStreakPath(...))`; zeroing all categories is fail-closed by design (worst case = manual approval, never wrongful auto-approve). `207d475`/`c8565a5` (journal scan I/O on approval path) — out_of_scope: substring pre-filter bounds parsing, runtime dirs are per-batch and pruned; performance tuning not in packet scope. `802c06f` (test should inject streakIo into `maybeAutoApproveIntegrateGate`) — already_correct: detection is deliberately journal-based so later calls need no injection; the reviewer's own alternative ("persist the unreliability state visible to subsequent calls without injection") is exactly the implemented design, and the test passes. |

## Blockers

_None._
