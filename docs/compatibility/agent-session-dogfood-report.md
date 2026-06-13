# agentSession worker dogfood report (Phase 22)

**Date:** 2026-06-11 (updated 2026-06-12 — FR-SHIP-09 decision)  
**Operator:** Cesar Delgado  
**Commit:** `2c72b9043c4b52bf2bf719facc1f2241dafe5858`  
**Batch:** _(none — no agentSession land-loop batch run)_  
**Worker backend under test:** `lanes.workerBackend: agentSession` (opt-in only)  
**Guided script:** [`scripts/stub-free-dogfood.sh --agent-session`](../../scripts/stub-free-dogfood.sh)

## Scope

Closes Phase 22 **FR-REL-08** (agentSession doctor/preflight) and **FR-REL-09** (abort fail-loud + journal) promotion sign-off. Validates the in-process `createAgentSession` worker path (`src/batch/agent-session-worker.mjs`) after SP-181 doctor checks and SP-182 abort journaling.

Complements the subprocess stub-free report ([`stub-free-dogfood-report.md`](stub-free-dogfood-report.md), TP-047) — same land-loop checklist, different worker backend.

**Reference:** [`docs/adoption/create-agent-session-spike.md`](../adoption/create-agent-session-spike.md)

## Environment

| Check | Result |
|-------|--------|
| `SPINE_WORKER_STUB` unset | **pass** |
| `@earendil-works/pi-coding-agent` peer | **pass** (v0.78.0 via `npm install`) |
| `lanes.workerBackend` | **deferred** — default `subprocess`; set `agentSession` before batch dogfood |
| `spine doctor` agentSession check | **pass** (subprocess effective); **pending** with `agentSession` config + peer |
| `spine preflight` | **pass** (2026-06-11, lane-2 worktree) |

## Manual checklist results

Run: `./scripts/stub-free-dogfood.sh --agent-session` (add `--batch <task>` to start a detached batch).

| # | Step | Command | Result | Notes |
|---|------|---------|--------|-------|
| 1 | Config | `lanes.workerBackend = agentSession` | **deferred** | Operator sets before batch; default remains `subprocess` |
| 2 | Peer install | `npm install @earendil-works/pi-coding-agent` | **pass** | Dev dependency v0.78.0 |
| 3 | Doctor | `spine doctor` | **pass** | Subprocess backend; re-run after config flip |
| 4 | Preflight | `spine preflight` | **pass** | Clean worktree, no active batch |
| 5 | Plan | `spine plan pending --json` | **pass** | JSON plan emitted |
| 6 | Batch start | `SPINE_WORKER_STUB=0 spine batch start <scope>` | **deferred** | Requires step 1 + attached operator session |
| 7 | Status | `spine status --diagnose` | **pass** | Pre-batch baseline |
| 8 | Abort path | forced abort journals `lane.worker_abort_failed` | **pass** | Automated: `tests/batch/agent-session-abort.test.mjs` (SP-182) |
| 9 | Gate inspect | `spine gate status` | **pass** | No gate pre-merge (expected) |
| 10 | Land loop | gate approve → integrate → complete | **deferred** | Post-batch operator steps |

## Execution log (2026-06-11)

```text
# Environment (lane-2 worktree, SP-183)
npm install                              → @earendil-works/pi-coding-agent@0.78.0
./scripts/stub-free-dogfood.sh --agent-session
  → SPINE_WORKER_STUB unset, peer installed, workerBackend subprocess (warn)
  → spine doctor pass, preflight pass, plan pending pass, status --diagnose pass

# Automated abort regression (SP-182)
npm run typecheck && SPINE_WORKER_STUB=1 npm test
  → agent-session-abort.test.mjs pass (lane.worker_abort_failed journaled)
```

## Automated regression (stub CI path)

**Command:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`  
**Result:** agentSession abort test pass (SP-182); full suite run at operator merge gate  
**Note:** `SPINE_WORKER_STUB=1` forces subprocess stub — agentSession path exercised via dedicated batch tests and manual dogfood only.

## Promotion decision (FR-SHIP-09 / SP-219)

**Decision:** **Defer promotion.** Subprocess `pi -p` (`lanes.workerBackend: subprocess`) **remains the default** worker backend for v1.0 ship and operator runbooks.

**Rationale:**

| Criterion | Status |
|-----------|--------|
| Land-loop sign-off with `agentSession` (checklist items 1, 6, 10) | **Not completed** — no agentSession batch has run through gate → integrate → complete |
| Subprocess real-pi dogfood | **Complete** — [`stub-free-dogfood-report.md`](stub-free-dogfood-report.md) (TP-047, batch `20260602T221506`) |
| agentSession automated abort path | **Complete** — SP-182 / `agent-session-abort.test.mjs` |
| agentSession doctor/preflight scaffold | **Complete** — SP-181; alignment with this decision tracked in SP-237 |
| Spike blockers B1–B4 | **Open** — reviewer still subprocess (`review.mjs`); no real-pi multi-lane agentSession soak; model/auth bridge gaps — see [`create-agent-session-spike.md`](../adoption/create-agent-session-spike.md) |

**Opt-in path (unchanged):** Operators may trial in-process workers after installing the peer dependency and flipping config:

```bash
npm install @earendil-works/pi-coding-agent
spine settings set lanes.workerBackend agentSession
spine doctor   # peer + backend checks (SP-237 aligns messaging)
./scripts/stub-free-dogfood.sh --agent-session --batch <small-task>
```

**Revisit promotion when:** (1) a small attached agentSession batch completes the land loop with evidence recorded here, and (2) reviewer parity or an explicit mixed-backend runbook is documented.

## Blockers

None for keeping subprocess as default. Full agentSession promotion (default flip) blocked by open spike items B1–B4 and missing land-loop batch evidence. Operator trial steps:

1. `spine settings set lanes.workerBackend agentSession`
2. Confirm `spine doctor` reports `pi-coding-agent peer available`
3. Run `./scripts/stub-free-dogfood.sh --agent-session --batch <small-task>`
4. Complete land loop (gate approve → integrate → complete) and update this report

Reviewer path remains subprocess (`review.mjs`) — see spike doc blocker B1.

## Sign-off

**Phase 22 agentSession infrastructure validated; v1.0 default remains subprocess.** Doctor/preflight checks (SP-181), abort fail-loud journaling (SP-182), and `--agent-session` guided script delivered. FR-SHIP-09 records explicit defer — not a failed experiment; subprocess is the production default until opt-in land-loop dogfood passes.

**Verdict:** pass (defer promotion; subprocess default confirmed)

— Cesar Delgado, 2026-06-12
