---
name: supervisor
description: Batch supervisor — monitors orchestration, handles failures, keeps operator informed
tools: read,write,edit,bash,grep,find,ls
# model:
---

## v1 reality

pi-spine **does not spawn a supervisor Pi agent session in v1**. Batch orchestration visibility and recovery are operator-driven: you monitor the batch, read reconciliation signals, and run CLI commands from your terminal.

This file is a **composable stub** copied to `.spine/agents/supervisor.md` on `spine init`. It documents how supervision works today and reserves space for future v1.1 automation — it is **not** loaded into a running agent in v1.

## Operator tools

Use these instead of a conversational supervisor:

| Tool | Purpose |
|------|---------|
| `spine status --diagnose` | Primary signal — diagnosis, phase, lanes, suggested next command |
| `spine status` / `spine next` | Headline status and copy-paste `suggestedCommand` |
| `spine journal replay --batch <batchId>` | Audit trail for a batch |
| `spine dashboard` | Local SSE UI (default `http://127.0.0.1:8109`) — diagnosis banner, lanes, gate, journal tail |

**Journal path:** `.spine/runtime/<batchId>/journal/events.jsonl`

**Detached engine log:** `.spine/runtime/detached-engine.log`

**Diagnosis quick map** (run `spine status --diagnose` daily):

| `diagnosis` | Typical next step |
|-------------|-------------------|
| `running` | Wait; use dashboard or `--diagnose` |
| `paused` | `spine batch resume` |
| `needs_retry` | `spine batch retry <id>` or skip |
| `needs_merge` | Fix failures or `force-merge` |
| `needs_integrate` | Land loop — gate approve → integrate → complete |
| `completed` | `spine batch complete` if not archived |
| `limbo_stale` / `completed_manual` | `dismiss` or `complete --detect-manual-merge` |
| `failed` / `aborted` | `retry`, `resume --force`, or `dismiss` |

Full operator procedures: [operator runbook](../../docs/adoption/operator-runbook.md).

In pi: `/spine-status` mirrors reconciliation; `/spine-dashboard` opens the dashboard.

## Project overrides

You may edit `.spine/agents/supervisor.md` in your consumer repo to capture project-specific orchestration notes, escalation contacts, or future supervisor prompt drafts.

- Overrides are **optional** — the batch engine does not read or spawn this agent in v1.
- Keep worker and reviewer agents under `.spine/agents/` for active batch roles; supervisor remains documentation until v1.1.

## Taskplane mutual exclusion

Do **not** run Taskplane `/orch` and `spine batch start` on the **same repo** concurrently. Only one orchestrator should own batch state at a time.

`spine doctor` and `spine preflight` inspect both `.spine/batch-state.json` (pi-spine) and `.pi/batch-state.json` (Taskplane). Finish or dismiss the other orchestrator's batch before starting spine.

Migrating from Taskplane: `spine migrate-from-taskplane`, run spine batches, then retire `/orch`. See runbook §8 (Taskplane coexistence).
