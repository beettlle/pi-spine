# SP-631: Approval streak counters for after-N — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-12
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Required files and paths exist
- [x] Dependencies satisfied

### Step 1: Streak store API
**Status:** ✅ Complete
- [x] Implement load/increment/reset helpers with atomic writes under runtime path
- [x] Unit tests for increment, reset, and threshold read

### Step 2: Testing & Verification
**Status:** 🟡 In Progress
- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Must Update docs modified (if any)
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-629 `.DONE` present; `gate-posture-config.mjs` + `atomic-write.mjs` exist | Dep satisfied |
| Persist under `.spine/runtime/gate-posture/streaks.json` | Match sequence-state + `writeJsonAtomic` |
| Keys: per category and per gate kind | Dual maps in one store file |
| Reset on reject / manual break | `resetCategoryStreak` / `resetKindStreak` / `resetAllStreaks` |
| Threshold read | `streakMeetsThreshold` + `readCategoryStreakThreshold` |
| Corrupt JSON | Fail-closed to zero counts |
| Plan review | skipped (real-pi nested spawn blocked) |

## Blockers

_None._
