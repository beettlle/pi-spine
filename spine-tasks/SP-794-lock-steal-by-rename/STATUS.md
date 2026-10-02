# SP-794: Lock steal-by-rename with token re-check — Status

**Current Step:** Step 1
**Status:** 🟨 In Progress
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
**Status:** 🟨 In Progress

- [ ] Helper used for every stale break
- [ ] Content compare for corrupt/invalid
- [ ] Put-back tolerated

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Two-concurrent-stealers
- [ ] Put-back unit test

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand` 3×
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | 5 unlink sites in `breakStaleLock`, each already wrapped in `try/catch` ("raced unlink"); none are token-gated. `releaseLockFile` is the only token-gated removal. |
| 2 | Corrupt branch does not retain the raw read text — must keep it for content comparison in the steal helper. |
| 3 | Baseline lock tests: 3/3 green, ~4.8s per run, no flakes. |
## Blockers

_None._
