# SP-779: Stall watchdog observes worker exit before deadline — Status

**Current Step:** Step 3 (Testing & Verification)
**Status:** 🟨 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Confirm deadline-before-exit ordering at HEAD (deadline branch L358, exit check L399)
- [x] List callers/tests of `pollWorkerUntilSettled` (worker-host.mjs:275 production; heartbeat.test.mjs:284,357)
- [x] Dependencies satisfied (none)

### Step 1: Exit-before-deadline ordering + injectable timing
**Status:** ⬜ Not Started

- [ ] Exit observed before deadline branch
- [ ] Injectable `deps = { now, sleep }`
- [ ] SP-738 / #272 behavior unchanged
- [ ] `worker-heartbeat.mjs` ≤ 500 lines

### Step 2: Deterministic tests
**Status:** ✅ Done

- [x] Virtual-clock tests (exit at virtual 10s under 12s contract budget → settled; hung child at virtual 5s under 2.4s global budget → stall_timeout, exitCode 124)
- [x] One real-subprocess classification test kept (global 3s / contract 30s / hang 6s — 5x margin)
- [x] Coverage-mode skip removed (`UNDER_COVERAGE` deleted; baseline E2E folded into the virtual stall test)
- [x] Ordering regression test in heartbeat.test.mjs (exit at virtual 600ms, deadline 550ms, poll at 600ms → settled; fails on old order)
- [x] 20× loop: **20/20 pass, 0 failures**

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `collectChildOutput` resolves on the `'close'` event, which always fires after `'exit'` sets `child.exitCode`; the agent-session handle sets `state.exitCode` before `wait()` resolves. Racing `childDone` against the inter-poll sleep therefore guarantees `workerChild.exitCode` is set when the race wakes — the exit check cannot miss or tight-spin. |
| 2 | `SPINE_WORKER_STUB_HANG_MS` stub hangs and then exits 1 **without .DONE** ("stub worker hang finished without .DONE"), so the kept E2E exercises "no stall before a real exit" and classifies `failed`, not success. |
| 3 | Production poll interval is 30s (`POLL_INTERVAL_MS`), capped to 5s in-loop; the E2E polls land at ~0s/5s/10s — a broken override (budget 3s) is caught by the 5s poll while the child still hangs. |
| 4 | Virtual-clock ordering scenario: budget 550ms, child exits at virtual 600ms, polls every 100ms — the exit fires during the sleep that crosses the deadline, so the next poll is past-budget with the child already exited. Old order → stall_timeout (flake reproduced); new order → settled. |
| 5 | 20× loop of `tests/batch/contract-stall-override.test.mjs`: 20/20 pass, 0 failures (wall ~2.5 min total, ~6.5s per run — dominated by the single real-subprocess E2E). |

## Blockers

_None._
