# SP-794: Lock steal-by-rename with token re-check — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-10-02
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Unlink sites mapped (5 sites in `breakStaleLock`: corrupt-stale ~216, invalid-pid ~227, leakedSelf ~247, deadPid ~260, pidRecycled ~286)
- [x] Baseline flake rate (3/3 runs pass, 10/10 tests, ~4.8s each, 0 failures)
- [x] Dependencies satisfied (none declared)

### Step 1: Steal-by-rename helper
**Status:** ✅ Complete

- [x] Helper used for every stale break (5 call sites: corrupt-stale, invalid-pid, leakedSelf, deadPid, pidRecycled; existing 10/10 lock tests pass with the new mechanism)
- [x] Content compare for corrupt/invalid (full raw file content; token path only when a non-empty token was observed)
- [x] Put-back tolerated (`linkSync`, `EEXIST` swallowed, renamed copy unlinked in `finally` so it is never stranded)

### Step 2: Tests
**Status:** ✅ Complete

- [x] Two-concurrent-stealers (dead-PID fixture, start-barriered children, 20 rounds, no overlapping critical sections; plus recycled-PID fixture variant covering the `ps`-window steal path E2E)
- [x] Put-back unit test (fresh lock with different token survives; plus token-match removal and corrupt content-compare unit tests)

**Artifacts:**
- `tests/batch/batch-state-lock.test.mjs` (modified)

**Evidence:** 15/15 tests pass (~10.2s); eslint clean on both changed files.

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` — clean, max-warnings 0)
- [x] Contract `testCommand` 3× — 3/3 runs, 28/28 tests each, exit 0 (worker env unset)
- [x] Batch suite — `SPINE_WORKER_STUB=1 npm run test:batch`: 1593/1593 pass (~173s)
- [x] Coverage gate — `npm run coverage:check`: 90.09% line (threshold 77%), underlying suite 2753/2753
- [x] Fix all failures — none encountered; also `npm run typecheck` clean and gitnexus `detect_changes` scope check confirmed only in-scope files/symbols changed

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (table below)
- [x] Create `.DONE`

**Completion criteria evidence:**
- Two concurrent breakers of a dead holder — exactly one acquires: proven by both two-stealer tests (dead-PID and recycled-PID fixtures; start-barriered head-to-head break; 20 rounds each; zero overlapping critical sections; zero stranded `.break.*` copies).
- A lock acquired between judge and break is never removed: proven by the put-back unit test (fresh lock with different token survives `stealIfTokenMatches` byte-for-byte) plus token-match and corrupt content-compare unit tests.

**Docs:** Must Update: None (SP-803). Check If Affected: None.

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | 5 unlink sites in `breakStaleLock`, each already wrapped in `try/catch` ("raced unlink"); none are token-gated. `releaseLockFile` is the only token-gated removal. |
| 2 | Corrupt branch does not retain the raw read text — must keep it for content comparison in the steal helper. |
| 3 | Baseline lock tests: 3/3 green, ~4.8s per run, no flakes. |
| 4 | On an idle machine the pre-fix double-break overlap cannot be reproduced by test children: each waiter sleeps `POLL_INTERVAL_MS` (25ms) between its break and its create, so both waiters' unlinks land before either's create (verified empirically: 14 runs against a temporarily reverted bare-unlink build, all green). The historical #302 overlap required scheduler preemption or a >25ms `ps` probe under suite load. The steal tests are therefore regression guards (no-overlap invariant + no stranded `.break.*` copies), while the put-back unit test deterministically pins the fix mechanism the old code lacked. |
| 5 | `stealIfTokenMatches` is exported so the put-back branch can be unit-tested; that race (fresh lock swapped in between judge and rename) cannot be scheduled deterministically through `withBatchStateLock`. |

## Blockers

_None._
