# SP-868: Gate approval-streak: lock streak read-modify-write (#314 remainder) — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-824 fail-closed behavior still present; locate streak I/O module(s)
- [x] GitNexus impact on streak helpers; report in STATUS

**Preflight findings:**
- SP-824 fail-closed confirmed in `src/batch/gate-posture-approve.mjs`: `journalHasUnrecoveredStreakReset` → `streak_unreliable` early return before any streak read; `recordRejectStreakReset` does best-effort streak-file removal + journals `gate.streak_io_failed` with `recovered` flag; `recordApprovalStreak` journals increment failures without reversing the persisted approval.
- Streak I/O module located: `src/batch/gate-posture-streak.mjs`. Unlocked RMW functions: `incrementCategoryStreak`, `incrementKindStreak`, `resetCategoryStreak`, `resetKindStreak`, `resetAllStreaks` (each load → mutate → `saveGatePostureStreaks`). Reads (`getCategoryStreak`, `getKindStreak`, `loadGatePostureStreaks`) are lock-free today; the auto-approve decision read lives in `gate-posture-approve.mjs:maybeAutoApproveIntegrateGate`.
- GitNexus impact on `incrementCategoryStreak`: risk UNKNOWN (index resolved the test stub in `tests/batch/gate-posture-streak-failure.test.mjs`, and index is 1 commit behind HEAD). Per the UNKNOWN rule, confirmed callers via text search: streak helpers are consumed only by `gate-posture-approve.mjs` `DEFAULT_STREAK_IO`; gate approve/auto-approve callers are `bin/spine-gate.mjs` (CLI), `src/batch/sequence-wait.mjs`, `src/batch/salvage-batch-integrate-gate.mjs`, and the `src/batch/gate.mjs` facade. None of these callers hold the batch-state lock around gate calls, and `appendJournalEvent` takes no lock — so serializing streak RMW on the shared `withBatchStateLock` primitive (re-entrant per process) is deadlock-safe here. Lock-ordering rules (SP-722) hold: streak critical sections never acquire the resume handoff lock.

---

### Step 1: Lock streak RMW
**Status:** ✅ Complete

- [x] Add lock around streak increment/reset/read used for auto-approve
- [x] Keep SP-824 journal + streak_unreliable behavior

**Implementation:**
- `src/batch/gate-posture-streak.mjs`: added `withGatePostureStreakLock(projectRoot, fn, options?)` — delegates to `withBatchStateLock` (same project-local lock primitive: exclusive lock file via temp+`linkSync`, PID-liveness stale breaking, token-gated release, per-process re-entrancy). All five RMW functions (`incrementCategoryStreak`, `incrementKindStreak`, `resetCategoryStreak`, `resetKindStreak`, `resetAllStreaks`) now run their load→mutate→save inside it. Plain reads stay lock-free (atomic writes already give readers old-or-new), except the auto-approve decision site below.
- `src/batch/gate-posture-approve.mjs`: `maybeAutoApproveIntegrateGate` now wraps the streak read → posture evaluation → auto-approve + increment sequence in `withGatePostureStreakLock`, making the read-decide-act atomic against concurrent locked resets/increments. Lock-acquisition failure propagates (no auto-approve happened — fail-closed), matching batch-state writer behavior; no approval is ever reported false after a persisted approve because the closure only mutates after the decision.
- SP-824 preserved: `streak_unreliable` journal scan still early-returns before the locked section; reset failures still fail-closed + journaled `gate.streak_io_failed`; increment failures still journal without reversing approval (both now surface as lock-or-IO errors inside their existing catch paths).
- Verification: `node --experimental-strip-types --test` on both streak test files → 15/15 pass; `npm run typecheck` → clean.

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Lock / concurrency coverage; keep existing streak-failure tests green

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged (runbook owned by SP-866)
- [ ] Create `spine-tasks/SP-868-gate-streak-lock/.DONE`

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
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 0 preflight | SP-824 fail-closed confirmed; streak I/O in `gate-posture-streak.mjs`; GitNexus UNKNOWN risk resolved by text-search caller audit |
| 2026-11-18 | Step 1 lock streak RMW | `withGatePostureStreakLock` added (delegates to `withBatchStateLock`); 5 RMW fns + auto-approve read-decide-act wrapped; 15/15 streak tests pass; typecheck clean |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
