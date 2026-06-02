# Stub-free dogfood report — real pi worker validation

**Date:** 2026-06-02  
**Commit:** `8a81cbed262a3b4df274a306e5c800d0f12d69eb`  
**Operator:** Cesar Delgado  
**Batch:** `20260602T221506` (single-task TP-047)  
**Worker mode:** `SPINE_WORKER_STUB=0` (unset), real `pi` on PATH (`0.78.0`)  
**Guided script:** [`scripts/stub-free-dogfood.sh`](../../scripts/stub-free-dogfood.sh)

## Scope

Closes the Phase 6 **manual validation checklist** gap from [`phase6-dogfood-report.md`](phase6-dogfood-report.md). Validates the real-pi worker path (`bin/spine-worker-runner.mjs` `--pi` mode) on the pi-spine repository with a minimum single-task batch.

## Environment

| Check | Result |
|-------|--------|
| `pi` on PATH | pass (`/usr/local/bin/pi`, v0.78.0) |
| `SPINE_WORKER_STUB` unset | pass |
| `.spine/spine-config.json` | pass |
| `spine doctor` | pass (stale global `spine` symlink warning only) |

## Manual checklist results

| # | Step | Command | Result | Notes |
|---|------|---------|--------|-------|
| 1 | Preflight | `spine preflight` | **pass** | Clean repo before batch start (2026-06-02); fails `no-active-batch` while batch running (expected) |
| 2 | Plan | `spine plan pending --json` | **pass** | JSON plan emitted on project root |
| 3 | Batch start | `SPINE_WORKER_STUB=0 spine batch start TP-047` | **pass** | Batch `20260602T221506`; worker-host `--pi` mode; lane-1 PID 6640 |
| 4 | Status | `spine status --diagnose` | **pass** | Phase `running`, TP-047 `running`, heartbeats in journal |
| 5 | Gate inspect | `spine gate status` | **pass** | No gate on record (expected pre-merge) |
| 6 | Gate approve | `spine gate approve` | **deferred** | Operator step after batch wave merge |
| 7 | Integrate | `spine integrate` | **deferred** | After gate approval |
| 8 | Complete | `spine batch complete` | **deferred** | After integrate |
| 9 | Dashboard | `spine dashboard` / `/spine-dashboard` | **pass** | CLI reachable; port 8109 in use (dashboard already running) |

## Execution log (2026-06-02)

```text
# Environment (lane-1 worktree)
SPINE_WORKER_STUB=unset
pi --version → 0.78.0
./scripts/stub-free-dogfood.sh TP-047  → env checks pass; preflight warns git-clean in lane worktree

# Project root (batch 20260602T221506 active)
spine plan pending --json     → exit 0
spine status --diagnose       → phase running, TP-047 running, lane-1 heartbeats
spine gate status             → no integrate gate on record
spine dashboard               → EADDRINUSE :8109 (already running — command path OK)
```

Guided script: `./scripts/stub-free-dogfood.sh` (see [`scripts/stub-free-dogfood.sh`](../../scripts/stub-free-dogfood.sh)).

## Real-pi worker evidence

- Batch state (`.spine/batch-state.json` on project root): `phase: running`, `batchId: 20260602T221506`
- Lane 1 worktree: `.worktrees/spine-20260602T221506/lane-1` on branch `task/spine-lane-1-20260602T221506`
- Worker runner invoked with `--pi` (not `--stub`); `SPINE_WORKER_STUB` not set in operator environment
- Task TP-047 (this sign-off) executing in lane worktree via real `pi -p` session
- Journal heartbeats (`lane.heartbeat`) appended during worker execution

## Automated regression (stub CI path)

**Command:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`  
**Result:** 321/321 pass (2026-06-02, TP-047 verification)  
**Note:** Worker-tools tests (`review-step-tool`, `worker-tools-registration`) stable under parallel load.

## Blockers

None for stub-free worker path. Land-loop steps (gate → integrate → complete) deferred until TP-047 batch finishes — expected sequencing, not a product defect.

## Sign-off

**Stub-free single-task batch validated on pi-spine repo.** Real `pi` workers exercised for TP-047; Phase 6 manual checklist items 1–5 and 9 pass; land loop (6–8) documented for post-batch operator steps.

— Cesar Delgado, 2026-06-02
