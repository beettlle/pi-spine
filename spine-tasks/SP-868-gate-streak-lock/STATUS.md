# SP-868: Gate approval-streak: lock streak read-modify-write (#314 remainder) — Status

**Current Step:** Complete
**Status:** ✅ Done — .DONE created
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
**Status:** ✅ Complete

- [x] Lock / concurrency coverage; keep existing streak-failure tests green

**Tests added to `tests/batch/gate-posture-streak.test.mjs` (batch-state-lock child-writer pattern):**
1. `concurrent multi-process increments lose no updates under the streak lock` — 3 spawned child processes × 10 `incrementCategoryStreak` RMW cycles; asserts final count 30 and lock file released.
2. `locked RMW waits for an external holder and applies on top of its write (no lost update)` — child acquires the lock, writes streak 7 through the unlocked load/save pair while holding it, signals readiness, holds 250ms, releases; parent's locked increment blocks, then yields 8 (would clobber to 1 without the lock). Ready-file barrier keeps it deterministic.
3. `withGatePostureStreakLock times out against a live foreign holder instead of racing` — crafted lock owned by a live foreign PID (test runner ppid + probed OS starttime so stale-breaking never steals); asserts `/Timed out acquiring batch-state lock/`, streak untouched, holder lock file preserved.
4. `auto-approve decision holds the streak lock through read, approve, and increment` — proof stub wrapping the real increment asserts the lock file exists at increment-commit time inside `maybeAutoApproveIntegrateGate`; gate approves (auto), streak 1→2, lock released.

**Tests added to `tests/batch/gate-posture-streak-failure.test.mjs` (contract `fileScopeMustChange`; lock errors route through SP-824 machinery):**
5. `streak reset lock timeout: fail-closed removal + journaled recovered:true` — foreign holder lock + injected reset that times out at 150ms via the real lock primitive; reject still persists, `gate.streak_io_failed` op=reset with `/Timed out acquiring batch-state lock/`, streak file removed (recovered), next read sees 0.
6. `streak increment lock timeout: approval persists, journaled recovered:undefined` — same contention against the approve path; approval persists with decidedBy human, op=increment journaled, streak stays 0 (no approval reversal).

Verification: 15/15 tests in the file pass (`node --experimental-strip-types --test`), including all pre-existing streak tests; `npm run lint` exit 0; `npm run typecheck` exit 0.

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [x] Fix all failures

**Contract run:** `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/gate-posture-streak-failure.test.mjs tests/batch/gate-posture-streak.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` → **exit 0** (28 tests).

**Failure found and fixed:** first contract run failed `tests/cli/phase23-exit-verify.test.mjs` — the `batch-loc-policy` check (500 LOC cap for `src/batch/*.mjs`) tripped because `gate-posture-approve.mjs` went 498 → 508 LOC. Fixed by compacting my own additions inside `maybeAutoApproveIntegrateGate` (comment tightened; `mergedTags` loop rewritten as one spread+filter with identical semantics: gate.tags first then tags, string-filtered). File now 499 LOC; no grandfather-list changes (out of scope by policy). Behavior verified unchanged by re-running the contract plus gate/sequence sweeps.

**Extra sweeps (beyond contract, all exit 0):** `gate.test.mjs`, `gate-posture-wire-approve/evaluate/stamp/defaults`, `batch-salvage-integrate`, `sequence-auto-approve(-flag)` — 90 tests. GitNexus `detect_changes` on the fix: no symbol-graph changes, risk low.

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (runbook owned by SP-866)
- [x] Create `spine-tasks/SP-868-gate-streak-lock/.DONE`

**Completion criteria (PROMPT) verification:**
- Streak RMW is lock-protected — ✅ 5 RMW fns + auto-approve read-decide-act under `withGatePostureStreakLock`.
- SP-824 fail-closed tests still pass — ✅ `gate-posture-streak-failure.test.mjs` green in contract run.
- Contract `testCommand` exits 0 — ✅ verified twice (after Step 2, after LOC fix).
- Closes #314 — ✅ delivery commit `fix(SP-868): lock gate approval-streak RMW (#314)`.

**Full-suite verification:** `./scripts/worker-verify.sh` (typecheck + `SPINE_WORKER_STUB=1 npm test`) with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset → **exit 0: 3264 pass, 0 fail** (243s). First attempt ran with the worker-session env inherited; subprocess-spawning tests correctly tripped the SP-482 nested-batch guard (`Nested batch start blocked: SPINE_IS_WORKER=1`) — environmental, not code-related; confirmed by re-running affected files with the env unset (8/8, then full suite green). PROMPT Environment note ("run with SPINE_IS_WORKER unset") is why the contract set excludes those files.

**Docs:** none required by PROMPT Must-Update; runbook left to SP-866 as instructed.

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Streak RMW now shares the batch-state lock file (`.spine/runtime/batch-state.lock`) via `withGatePostureStreakLock` — re-entrant per process, so gate calls nested inside batch-state sections pass through; streak critical sections never take the resume handoff lock (SP-722 ordering holds) | Kept (documented in helper JSDoc) | `src/batch/gate-posture-streak.mjs` |
| `batch-loc-policy` (phase23 exit verify) caps `src/batch/*.mjs` at 500 LOC; `gate-posture-approve.mjs` had only 2 lines of headroom (498). New gated code fits because mergedTags compaction offset the lock wrapper. Future gate-posture work may need a module split | Noted for planners | `bin/spine-cli/verify.mjs` (untouched), `src/batch/gate-posture-approve.mjs` (499 LOC) |
| Worker-session env (`SPINE_IS_WORKER=1`) breaks any test that spawns batch engines via subprocess; full suite must run with it unset (SP-482 guard works as designed) | Confirmed environmental; not a defect | `scripts/worker-verify.sh` usage |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 0 preflight | SP-824 fail-closed confirmed; streak I/O in `gate-posture-streak.mjs`; GitNexus UNKNOWN risk resolved by text-search caller audit |
| 2026-11-18 | Step 1 lock streak RMW | `withGatePostureStreakLock` added (delegates to `withBatchStateLock`); 5 RMW fns + auto-approve read-decide-act wrapped; 15/15 streak tests pass; typecheck clean |
| 2026-11-18 | Step 2 lock tests | 4 SP-868 tests added (multi-process RMW, hold-and-observe, foreign-holder timeout, auto-approve lock proof); lint + typecheck exit 0 |
| 2026-11-18 | Step 3 contract | testCommand exit 0 (28 tests) after LOC fix (508→499, mergedTags compaction); gate/sequence sweeps exit 0 (90 tests) |
| 2026-11-18 | Step 4 delivery | worker-verify.sh exit 0 (3264 pass / 0 fail, env unset); engine e2e gate sweeps exit 0; failure-file lock-timeout tests added (6/6 pass, contract re-run exit 0); .DONE created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
