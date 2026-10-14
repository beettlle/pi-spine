# SP-824: Gate streak reset failure fails closed — Status

**Current Step:** Step 1: Journal and fail closed
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
**Status:** ⬜ Not Started

- [ ] Journal both catches
- [ ] `rmSync` fallback
- [ ] `streakIo` seam

### Step 2: Block auto-approve
**Status:** ⬜ Not Started

- [ ] `streak_unreliable`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Four cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Fix all failures

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

## Blockers

_None._
