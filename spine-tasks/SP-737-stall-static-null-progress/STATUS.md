# SP-737: Stall watchdog treats static-null progress as non-progress — Status

**Current Step:** Step 3 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read `checkpointSignalsChanged` / heartbeat progress snapshot construction
- [x] Confirm existing stall tests and SAT-020 coverage gaps for static-null

---

### Step 1: Treat static-null as non-progress
**Status:** ✅ Complete

- [x] Progress signal change must require a real signal delta (mtime/commit/dirty), not heartbeat emission or child liveness alone
- [x] Static-null snapshots across heartbeats must not refresh the stall anchor
- [x] Past budget: emit stall warning/kill journal events (match existing stall event types)

---

### Step 2: Regression tests
**Status:** ✅ Complete

- [x] Unit/integration: simulated static-null heartbeats past budget → stall classification
- [x] Child-alive-but-idle must not defeat stall (document SIGSTOP-style proxy in test comments)

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint
- [ ] Run Contract testCommand

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updates
- [ ] Create `.DONE`

---

## Discoveries

| Area | Finding |
|------|---------|
| Root cause | `pollWorkerUntilSettled` (src/batch/worker-heartbeat.mjs) slides `stallAnchorAt = nextStallAnchorAt(...)` on every `worker_alive` heartbeat when phase is `pi`/`subprocess` (SP-341, engine-lanes/watch.mjs). The engine emits those heartbeats itself whenever the child has not exited and no signals changed, so a hung/SIGSTOP'd worker slides the stall deadline forward forever — no `lane.stall_warning`/`lane.stall_killed` is ever journaled (exactly #272's journal). |
| Signal deltas are already honest | `checkpointSignalsChanged` / `activitySignalsChanged` are pure prev/next signal comparisons — they do NOT count heartbeat emission or child liveness. The liveness leak is only the anchor slide. |
| `worker_alive` payload is always static-null | `buildHeartbeatPayloadFields` omits progress fields for `worker_alive` kind — journaled heartbeats always show `statusMtimeMs/lastCommitAtMs/fileScopeMtimeMs: null, dirtyPathCount: 0`, matching #272's excerpt. |
| Stall events exist downstream | `recordStallWarning` → `lane.stall_warning` (heartbeat.mjs); `stall_timeout` classification → engine `lane.stall_killed` + salvage (worker-output.mjs). Making the deadline reachable re-enables both; ordering is covered by stall-sat020-integration.test.mjs. |
| SAT-020 gap | SAT-020 disables heartbeats (`heartbeatIntervalMinutes: 60`) so the anchor-slide path is bypassed; its file-scope touch also keeps signals non-null. No existing test covers static-null + active heartbeats. |
| Plan | 1) Add `isStaticNullProgressSnapshot(signals)` helper to heartbeat.mjs (four mission fields null/zero). 2) In worker-heartbeat.mjs heartbeat block, skip the `nextStallAnchorAt` slide when `heartbeatKind === "worker_alive" && isStaticNullProgressSnapshot(signals)`. Non-null static snapshots keep SP-341 liveness grace (healthy mid-step workers with STATUS.md/checkpoints are unaffected; subprocess-active workers keep sliding — matches mission's four-field list). 3) Regression tests in tests/batch/heartbeat.test.mjs driving `pollWorkerUntilSettled` directly with a never-exiting fake child (SIGSTOP proxy). |
| Pre-existing test env failure | `startBatch records lane.heartbeat during stub worker delay` fails in worker sessions because `SPINE_IS_WORKER=1` blocks nested batch spawns (SP-482 guard). Verified failing on clean base via `git stash` — environmental, not caused by SP-737 changes. |

## Notes

- engine-lanes/watch.mjs is out of File Scope → gate the slide at the worker-heartbeat.mjs call site instead of modifying `shouldSlideStallAnchorOnHeartbeat`.
- Engine-level `lastCommitAtMs` is usually non-null (lane branch has a setup commit), so the all-null static-null case is exercised at the `pollWorkerUntilSettled` level with an empty temp dir (no git, no STATUS.md) — the same observable state as #272's incident journal.
