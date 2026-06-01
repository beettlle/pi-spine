# Incident Report: Phase 0 Taskplane Batch `20260531T165700`

**Date:** 2026-05-31  
**Orchestrator:** Taskplane (`/orch all`)  
**Repo:** pi-spine (dogfooding Phase 0 tasks TP-002–TP-005)  
**Outcome:** 3/4 tasks succeeded; TP-002 failed twice (stall, then retry/resume failures)  
**Operator time lost:** ~2+ hours of manual recovery (batch-state surgery, abort/retry cycles)

This document captures failures observed while building pi-spine using Taskplane. It is the primary input for PRD and plan updates — pi-spine exists to prevent recurrence.

---

## Executive summary

A four-lane Phase 0 batch ran in parallel on a greenfield repo. Three tasks completed cleanly. **TP-002 (`spine init`) failed not because tests failed, but because the worker stalled out of checkpoint discipline** — then **recovery tooling made things worse**: retry did not reset segment state, resume skipped re-execution, abort deleted batch state, and the operator had to hand-repair JSON to get lane-1 running again.

Salvaged implementation in the lane-1 worktree was valid (5/5 tests passing) but never committed or marked `.DONE` before the stall kill.

---

## Timeline

| Time (approx) | Event |
|---------------|-------|
| T+0 | Batch `20260531T165700` started; 4 parallel lanes (TP-002, TP-003, TP-004, TP-005) |
| T+8 min | TP-005, TP-003, TP-004 complete; `.DONE` + lane commits |
| T+61 min | TP-002 stall timeout — monitor kills lane-1 worker (exit 143); tests pass in ~3s when run manually |
| T+62 min | Operator requests TP-002 retry only |
| T+63 min | `orch_retry_task` blocked while batch executing; pause ineffective; **hard abort** corrupts `.pi/batch-state.json` |
| T+65 min | Manual batch-state repair; invalid schema fields (`lastError`, `taskExits`, segment `completed` vs `succeeded`) |
| T+66 min | `orch_retry_task` succeeds but **resume sees `pendingSegments=0`** — merges lanes 2–4, does not re-run TP-002 |
| T+67 min | Takeover + graceful abort; **batch-state deleted again** |
| T+68 min | Full batch-state rewrite with TP-002 segment `pending`; resume shows **`pendingSegments=1`**; lane-1 worker re-spawned in existing worktree |

---

## Incident catalog

### I-01 — Stall false positive on productive worker (TP-002)

**Symptom:** Monitor logged `stall detected — killing agent (stallMinutes=60)` while worker had substantial uncommitted work.

**Evidence:**
- Lane-1 worktree contained `bin/spine-init.mjs`, `templates/`, `tests/` (uncommitted)
- `npm test` and `npm run typecheck` passed locally (~3s)
- Dashboard last tool: test command — worker likely in long LLM turn without tool calls
- STATUS.md stuck at Step 2 in progress; Steps 0–1 complete but Step 2 checkboxes unchecked

**Root cause:** Stall detector treats **absence of tool calls** as stall, not **absence of progress** (STATUS updates, git commits, heartbeat).

**Impact:** 60 minutes of wasted compute; valid work at risk.

**pi-spine requirement:** See PRD §18.4 (progress-aware stall detection), FR-WORK-09 (checkpoint heartbeat).

---

### I-02 — `orch_retry_task` does not reset segment frontier

**Symptom:** After `orch_retry_task TP-002`, task record showed `pending` but segment `TP-002::default` remained `failed`.

**Evidence:** Resume log: `segment frontier reconstructed (pendingSegments=0)` on first retry attempt.

**Root cause:** Retry mutates `tasks[]` only; `segments[]` status unchanged. `reconstructSegmentFrontier()` derives execution plan from segments, not task status alone.

**Impact:** Retry appears to succeed in UI but resume **skips re-execution** and proceeds to merge succeeded lanes.

**pi-spine requirement:** PRD §18.5 (atomic task retry — task + segment + counters).

---

### I-03 — Batch state schema fragile after abort

**Symptom:** Hard abort left `.pi/batch-state.json` invalid; MCP tools refused load.

**Invalid fields observed:**
- `lastError` as string instead of `{ code, message }`
- `diagnostics.taskExits[taskId]` as `{ code, reason }` instead of `{ classification, cost, durationSec }`
- Segment status `completed` instead of valid `succeeded`
- `classification: "stall"` instead of canonical `stall_timeout`

**Impact:** All orch MCP tools blocked until manual JSON surgery.

**pi-spine requirement:** PRD §10.1 (validated schema + migration), §18.6 (abort archives state; never silent delete).

---

### I-04 — Abort deletes batch state (graceful and hard)

**Symptom:** After `orch_abort`, `.pi/batch-state.json` removed entirely.

**Mitigation available:** Taskplane can reconstruct from `.pi/runtime/{batchId}/` via force-resume, but reconstruction sets `segments: []` — **loses segment topology** (TP-187 guard).

**Impact:** Operator must hand-rebuild segment records or accept lossy resume.

**pi-spine requirement:** Journal-first recovery (§18.2); `.spine/batch-state.json` is cache only; abort writes archive snapshot.

---

### I-05 — Mixed-outcome resume conflates merge with retry

**Symptom:** After failed TP-002, force-resume started merging lanes 2–4 while TP-002 still pending/failed.

**Impact:** Batch entered `merging` phase with 1 failed task; operator unclear whether batch is "done enough" to integrate.

**pi-spine requirement:** PRD §17.4 (mixed-outcome policy — block merge until all wave tasks terminal or explicitly skipped).

---

### I-06 — Retry blocked during active batch phases

**Symptom:** `orch_retry_task` rejected while phase `executing` / `merging`.

**Operator workaround:** Pause (did not stop worker) → hard abort (destructive).

**pi-spine requirement:** PRD §18.7 — safe single-task retry without full abort; IPC path to reset one lane.

---

### I-07 — STATUS checkpoint drift undetected

**Symptom:** Worker completed Steps 0–1 (templates exist) but STATUS checkboxes and step boundaries lagged reality.

**Impact:** Resume/reviewer/supervisor see false progress; stall recovery cannot trust STATUS.

**pi-spine requirement:** FR-WORK-02 strengthened; monitor validates STATUS/file consistency before stall kill.

---

### I-08 — Post-mortem tooling misleading

**Symptom:** Supervisor summary: *"No recommendations — batch ran smoothly"* with TP-002 failed.

**Impact:** Operator trust erosion; hides actionable recovery steps.

**pi-spine requirement:** NFR-OBS-03; gate summary generation on task failure count.

---

### I-09 — Dogfooding before orchestrator maturity

**Symptom:** Phase 0 used Taskplane `/orch all` on the repo whose product goal is to **replace Taskplane's failure modes**.

**Contributing factors:**
- Task packets created but not all committed before batch
- No CI yet when batch started (TP-003 added CI in parallel)
- No pi-spine batch engine — no `/spine-resume` to compare against

**pi-spine requirement:** Revised Phase 0 plan (PRD §23, CONTEXT.md) — serial bootstrap tasks first, parallel only after preflight passes.

---

### I-10 — Plan review skipped on L2 task

**Symptom:** Plan review tool failed; TP-002 worker proceeded without plan approval (Review Level 2).

**Impact:** Larger blast-radius changes without plan gate — may contribute to long uncheckpointed iterations.

**pi-spine requirement:** FR-REV-06 — fail closed when review tool unavailable at level > 0.

---

## Salvaged state (lane-1 at time of retry)

```
## task/cdelgado-lane-1-20260531T165700
 M bin/spine.mjs
 M package.json
?? bin/spine-init.mjs
?? templates/
?? tests/
```

Tests: 5/5 pass. No `.DONE`. STATUS at Step 2 / 29%.

---

## Recovery procedure that worked

1. Stop active merge/workers (`supervisor_takeover` or abort).
2. Write valid `.pi/batch-state.json` with:
   - TP-002 task: `pending`
   - TP-002 segment: **`pending`** (not `failed`)
   - TP-003/004/005: `succeeded` tasks and segments
   - `phase: stopped`, `failedTasks: 0`, `lastError: null`
3. `orch_resume(force=true)`
4. Confirm log: `pendingSegments=1` and `re-executing interrupted task in existing worktree`

### pi-spine recovery (Phase 1b — after TP-009/TP-010)

After manual git merge to `main`, if Taskplane still shows red **stopped** with all tasks green and empty `mergeResults`:

1. `spine status --diagnose` — expect `completed_manual` or `limbo_stale`
2. `spine batch dismiss --reason manual-merge-on-main` **or** `spine batch complete --detect-manual-merge`
3. Do **not** hand-edit `.pi/batch-state.json`; pi-spine archives to `.spine/runtime/{batchId}/archive/` first

---

## Required pi-spine deltas (traceability)

| Incident | PRD section | Phase |
|----------|-------------|-------|
| I-01 Stall false positive | §18.4, FR-WORK-09 | 3 |
| I-02 Segment retry gap | §18.5, FR-BATCH-09 | 3 |
| I-03 Schema fragility | §10.1, §18.6 | 0–1 |
| I-04 Abort deletes state | §18.6, FR-BATCH-06 | 3 |
| I-05 Mixed-outcome merge | §17.4, FR-BATCH-10 | 3 |
| I-06 Retry while running | §18.7, FR-BATCH-09 | 3 |
| I-07 STATUS drift | FR-WORK-02, FR-WORK-10 | 2–3 |
| I-08 Bad post-mortem | NFR-OBS-03 | 4 |
| I-09 Dogfood ordering | §23, CONTEXT.md | 0 |
| I-10 Review fail-open | FR-REV-06 | 4 |

---

## Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-31 | Initial report from Phase 0 batch recovery |
