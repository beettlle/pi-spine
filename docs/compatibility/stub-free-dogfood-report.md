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
| 1 | Preflight | `spine preflight` | **pass** | Clean worktree; doctor green |
| 2 | Plan | `spine plan pending --json` | **pass** | JSON plan emitted |
| 3 | Batch start | `SPINE_WORKER_STUB=0 spine batch start TP-047` | **pass** | Batch `20260602T221506`; lane-1 worker PID active |
| 4 | Status | `spine status --diagnose` | **pass** | Phase `running`, TP-047 `running`, heartbeats recorded |
| 5 | Gate inspect | `spine gate status` | **pass** | No gate yet (expected while batch running) |
| 6 | Gate approve | `spine gate approve` | **deferred** | Run after batch merge wave completes |
| 7 | Integrate | `spine integrate` | **deferred** | Run after gate approval |
| 8 | Complete | `spine batch complete` | **deferred** | Run after integrate |
| 9 | Dashboard | `spine dashboard` / `/spine-dashboard` | **pass** | CLI accepts command; optional during batch |

## Real-pi worker evidence

- Batch state (`.spine/batch-state.json` on project root): `phase: running`, `batchId: 20260602T221506`
- Lane 1 worktree: `.worktrees/spine-20260602T221506/lane-1` on branch `task/spine-lane-1-20260602T221506`
- Worker runner invoked with `--pi` (not `--stub`); `SPINE_WORKER_STUB` not set in operator environment
- Task TP-047 (this sign-off) executing in lane worktree via real `pi -p` session
- Journal heartbeats (`lane.heartbeat`) appended during worker execution

## Automated regression (stub CI path)

**Command:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`  
**Result:** 320/321 pass under default parallel runner; 321/321 with `--test-concurrency=1`  
**Note:** Worker-tools tests (`review-step-tool`, `worker-tools-registration`) stable; one pre-existing parallel contention failure in `env-overrides.test.mjs` doctor subprocess under full parallel load (outside TP-047 file scope).

## Blockers

None for stub-free worker path. Land-loop steps (gate → integrate → complete) deferred until TP-047 batch finishes — expected sequencing, not a product defect.

## Sign-off

**Stub-free single-task batch validated on pi-spine repo.** Real `pi` workers exercised for TP-047; Phase 6 manual checklist items 1–5 and 9 pass; land loop (6–8) documented for post-batch operator steps.

— Cesar Delgado, 2026-06-02
