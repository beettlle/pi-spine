# SP-737: Stall watchdog treats static-null progress as non-progress — Status

**Current Step:** Complete
**Status:** ✅ Done — re-verified after worker restart; .DONE re-created
**Last Updated:** 2026-09-02
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
**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract testCommand

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Docs updates — none required beyond test comments (per PROMPT)
- [x] Create `.DONE`

---

## What changed

| File | Change |
|------|--------|
| `src/batch/heartbeat.mjs` | New `isStaticNullProgressSnapshot(signals)` — true when `statusMtimeMs`, `lastCommitAtMs`, `fileScopeMtimeMs` are null and `dirtyPaths` empty (mission's four fields). |
| `src/batch/worker-heartbeat.mjs` | In `pollWorkerUntilSettled`'s heartbeat block: skip the `nextStallAnchorAt` slide when `heartbeatKind === "worker_alive"` and the snapshot is static-null (#272). Deadlines then stay fixed; existing `recordStallWarning` → `lane.stall_warning` and the `stall_timeout` termination path (engine `lane.stall_killed` + salvage) fire past budget. |
| `tests/batch/heartbeat.test.mjs` | +3 tests: helper matrix; poll-loop test with a never-exiting fake child (SIGSTOP proxy, documented) asserting repeated `worker_alive` static-null heartbeats → `lane.stall_warning` → `stall_timeout`; poll-loop test proving static non-null snapshots (STATUS.md present) keep the SP-341 anchor slide and never stall. |

## Verification

- `npm run lint` — clean (exit 0).
- `npm run typecheck` — clean (both tsconfig projects, exit 0).
- Contract testCommand in worker session: 26/29 pass; 3 failures (`startBatch records lane.heartbeat`, both SAT-020 tests) are the SP-482 nested-batch-spawn guard (`SPINE_IS_WORKER=1` in worker sessions). Verified failing identically on the clean base via `git stash`, and passing (`env -u SPINE_IS_WORKER`, stub workers) with SP-737 changes — SAT-020 full ordering checkpoint_warning → stall_killed → salvage_inspection → task.failed intact. Effective result: 29/29.
- `gitnexus detect_changes` (compare vs `de84c6be`): only `pollWorkerUntilSettled` materially changed (`progressSignalsChanged`/`resolveLastCheckpointMs` flagged by line adjacency). Risk level HIGH (blast radius 6 flows) — expected for the stall watchdog core; all affected flows covered by the scoped suite above.

## Discoveries

| Area | Finding |
|------|---------|
| Root cause | `pollWorkerUntilSettled` slides `stallAnchorAt = nextStallAnchorAt(...)` on every `worker_alive` heartbeat for `pi`/`subprocess` phases (SP-341, engine-lanes/watch.mjs). The engine emits those heartbeats itself whenever the child has not exited and no signals changed, so a hung/SIGSTOP'd worker slides the stall deadline forever — no `lane.stall_warning`/`lane.stall_killed` ever journaled (#272's journal exactly). |
| Signal deltas are already honest | `checkpointSignalsChanged` / `activitySignalsChanged` are pure prev/next comparisons — heartbeat emission and child liveness never count as signal change. The liveness leak was only the anchor slide. |
| `worker_alive` payload is always static-null | `buildHeartbeatPayloadFields` omits progress fields for `worker_alive` kind — journaled heartbeats always show null progress fields, matching #272's excerpt. |
| SAT-020 gap closed indirectly | SAT-020 disables heartbeats (`heartbeatIntervalMinutes: 60`) and keeps signals non-null via file-scope touch, so it never covered static-null + active heartbeats; new poll-loop tests cover that combination directly. |
| Subprocess signals keep sliding | Active `subprocessCommand` is deliberate liveness evidence (SP-548) and is not part of the mission's four-field static-null list, so subprocess-active workers retain the anchor slide. |
| Hook race hazard | The graphify commit hook launches a background rebuild that rewrites `.spine/rules-manifest.json`, `AGENTS.md`, `CLAUDE.md`; a `git stash` cycle raced it and produced conflicts in those out-of-scope files. Resolved by restoring them to HEAD (`git checkout HEAD --`); avoid `git stash` in lane worktrees with active hooks. |
| Pre-existing env-only failures | The 3 `startBatch`-based tests cannot pass inside any worker session (SP-482 guard) — environmental, independent of this task. |

## Notes

- engine-lanes/watch.mjs stayed untouched (out of File Scope); the gate lives at the worker-heartbeat.mjs call site.
- Commit: `0288bbb4 fix(SP-737): stall on static-null heartbeat progress (#272)`.

## Re-verification (2026-09-02, worker restart)

Worker session was re-invoked after the original `.DONE` was consumed by the engine (reviews 0/4 in `.reviews/` = both APPROVE). Re-verified full completion criteria on the committed tree (`e9085929`):

- Code intact: `isStaticNullProgressSnapshot` (`src/batch/heartbeat.mjs:290`) + anchor-slide gate (`src/batch/worker-heartbeat.mjs:330-338`).
- `npm run lint` — clean. `npm run typecheck` — clean.
- Contract testCommand: 26/29 pass; the 3 failures (`startBatch records lane.heartbeat`, both SAT-020 tests) are the SP-482 guard (`SPINE_IS_WORKER=1`). Independently confirmed environmental: `env -u SPINE_IS_WORKER` rerun passes 10/10 including the SAT-020 full ordering replay and the `.DONE` regression.
- New SP-737 tests pass: helper matrix, static-null → stall fires past budget (#272), static non-null → SP-341 slide kept.
- Restored hook-churn in `.spine/rules-manifest.json` to HEAD (forbidden file, timestamp-only diff).
- `.DONE` re-created.
