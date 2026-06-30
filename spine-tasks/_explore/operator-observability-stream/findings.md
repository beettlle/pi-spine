# Operator observability stream — explore findings

**Date:** 2026-06-29  
**Slug:** `operator-observability-stream`  
**Source:** [GitHub #52](https://github.com/beettlle/pi-spine/issues/52), [Epic #43](https://github.com/beettlle/pi-spine/issues/43), FR-SHIP-11 defer, PRD §4.2 / §16.3

## Summary

Phase 46 (SP-360–367) delivers **orchestration-tier** monitoring: reconcile polling, journal lifecycle follow, bounded progress snapshots, and redacted lane worker logs. Issue #52 asks for **agent-tier** observability — structured pi tool calls, assistant messages, and step boundaries in real time at batch scale.

**Recommendation:** Defer agent-tier streaming to **v2.3+** after Phase 46 lands. When implemented, prefer **journal-first** ingestion with an optional **per-lane SSE fan-out** for dashboard consumers. Do **not** conflate with FR-SHIP-11 supervisor agent; a supervisor polls batch health and journals `supervisor.nudge` — it does not replicate pi transcripts.

## Problem statement

| Tier | What operators see today (post Phase 46) | Gap (#52) |
|------|------------------------------------------|-----------|
| **Tier 0** | `spine status --diagnose`, dashboard reconciliation banner | Batch-level only |
| **Tier 1** | `spine watch`, `spine journal follow`, `spine wait` (SP-360–362) | Control-plane events, not agent turns |
| **Tier 2** | `lane.progress_snapshot`, live `worker-live-*.log`, `spine lane logs --follow` (SP-364–366) | Redacted stdout/transcript chunks; not structured tool-call events |
| **Tier 3 (deferred)** | — | Structured pi events: tool name, args shape, assistant text, step boundaries, per-lane stream with backpressure |

Tier 1–2 improve stall diagnosis and scriptability without violating PRD non-goals. Tier 3 is a new product surface with security, volume, and NFR-OBS-04 implications.

## Architecture constraint (NFR-OBS-04)

All monitoring commands and dashboard views must call **existing** `reconcileBatch()` / journal helpers — no parallel monitoring logic ([Epic #43](https://github.com/beettlle/pi-spine/issues/43)).

For Tier 3:

- **Reconcile path unchanged** — agent stream is additive telemetry, not a second source of batch truth.
- **Dashboard SSE** (`/api/events`) today polls `buildDashboardSnapshot()` every 2s; agent events must either merge into that snapshot or add a **separate loopback-only** endpoint so reconcile parity tests stay isolated.
- **CLI parity** — any new stream command should read the same canonical event store the dashboard uses (journal tail or lane-scoped buffer), not re-parse pi session files ad hoc.

## Design options

### Option A — Journal stream (append-only agent events)

**Shape:** Worker host or agentSession backend emits new journal types (e.g. `agent.tool_call`, `agent.message`, `agent.step_boundary`) into `.spine/runtime/<batchId>/journal/events.jsonl` with bounded payloads.

| Pros | Cons |
|------|------|
| Fits Babysitter-style append-only audit model | Journal volume grows quickly on real-pi batches |
| `spine journal follow` (SP-361) extends naturally | Large args/tool outputs need aggressive truncation |
| Post-mortem export (FR-SHIP-08) includes agent timeline | Must not block worker poll loop (async append + backpressure) |
| Single artifact for incident bundles | Rebuild/reconcile must ignore agent events (control-plane only) |

**Implementation anchors:** `src/batch/journal.mjs`, `src/batch/worker-host.mjs`, `src/batch/agent-session-worker.mjs`, `src/worker-tools/report-progress.mjs` (`task.step_completed` precedent).

**Payload sketch (bounded):**

```json
{
  "type": "agent.tool_call",
  "taskId": "SP-042",
  "laneId": "lane-1",
  "tool": "edit",
  "argKeys": ["path"],
  "argBytes": 1204,
  "truncated": true,
  "correlationId": "…"
}
```

### Option B — Per-lane SSE (live fan-out)

**Shape:** Loopback HTTP server exposes `/api/lanes/<laneId>/events` (SSE) or multiplexes lane channels on dashboard port 8109. Producers write to an in-memory ring buffer or tail a lane-scoped jsonl under `.spine/runtime/<batchId>/lanes/lane-N/agent-events.jsonl`.

| Pros | Cons |
|------|------|
| True real-time UX for dashboard lane detail (SP-367) | Second transport beside journal — drift risk if not journal-backed |
| Backpressure via SSE `close` / client drop | Multi-lane batches multiply connections |
| Can sample/throttle without persisting every token | Remote access remains out of scope (PRD §16.3) — loopback only |

**Implementation anchors:** `src/dashboard/server.mjs` (`/api/events` poll pattern), `src/dashboard/snapshot.mjs`, future lane detail panel (SP-367).

**Hybrid (recommended):** Persist **summarized** events to journal (Option A) for audit; SSE reads **tail of lane buffer** or last N journal agent events for live UI. Journal remains source of truth after batch completes.

### Option C — Supervisor agent stream

**Shape:** Autonomous pi session polls `reconcileBatch`, tails journal, optionally spawns nudges — streams its own reasoning to journal as `supervisor.nudge` / `supervisor.observation`.

| Pros | Cons |
|------|------|
| Addresses FR-SHIP-11 stretch (health polling) | Does **not** satisfy #52 — supervisor ≠ worker transcript |
| Composes with Tier 1 CLI | Extra pi session cost, auth, stall risk (nested spawn lessons SP-194) |
| Could correlate batch diagnosis with narrative | Conflating supervisor and worker streams confuses operators |

**Verdict:** Keep FR-SHIP-11 supervisor defer separate. If a minimal supervisor ships later, its events are **batch-health** telemetry, not a substitute for Option A/B.

## Security, volume, and redaction

| Constraint | Requirement | Existing pattern |
|------------|-------------|------------------|
| **Secrets** | No raw API keys, tokens, connection strings in streams | `redactWorkerOutput()` in `worker-output.mjs` (SP-365 extends to live log) |
| **Volume** | Per-lane byte caps, truncation markers, optional sampling | `workerOutputMaxBytes`, `workerLiveLogMaxBytes`, `TRUNCATION_MARKER` |
| **Tool args** | Log tool **name** + key list + byte count; hash or omit bodies by default | New `lanes.agentEventMaxBytes` config |
| **PII** | Configurable deny patterns (`workerOutputDenyPatterns`) | Same hook as stall capture |
| **Loopback** | No remote dashboard / auth in v1 (PRD §16.3) | `assertLoopbackHost()` in dashboard server |
| **Deterministic replay** | Explicit non-goal (PRD §4.2) | Journal records boundaries; no `run:iterate` for LLM streams |

**Fail-safe default:** Agent event streaming **off** by default (`lanes.streamAgentEvents: false`), mirroring `lanes.streamWorkerOutputLive` (SP-365).

## Stall detection interaction

Progress-aware stall (FR-WORK-10, GAP-STALL-01) uses STATUS mtime, git commits, `task.step_completed`, and `lane.progress_snapshot` — **not** tool-call silence alone.

Tier 3 streams must **not** reintroduce tool-call-only stall heuristics. High-frequency agent events are noisy; stall signals stay on orchestration progress signals (SP-364).

## Comparison matrix

| Criterion | A: Journal | B: Per-lane SSE | C: Supervisor |
|-----------|------------|-----------------|---------------|
| Closes #52 acceptance | Yes (with follow CLI) | Yes (with dashboard) | No |
| NFR-OBS-04 safe | Yes (if reconcile ignores) | Medium (needs shared store) | Yes (batch-level) |
| Audit / export | Excellent | Good if journal-backed | Partial |
| Implementation cost | Medium | Medium–High | Low–Medium (wrong problem) |
| Multi-lane scale | jsonl append scales | Connection × lanes | One session |
| v2.2 scope | No — deferred | No — deferred | Already deferred (FR-SHIP-11) |

## Recommended phasing (after SP-360–367)

| Phase | Prerequisite | Deliverable | Closes |
|-------|--------------|-------------|--------|
| **P0** | SP-360–367 merged | Operators use watch / journal follow / lane logs; validate Tier 2 suffices in consumer pilot | — |
| **P1** | Pilot feedback + config schema | Explore → implementation packet: journal agent event types + redaction tests | #52 implementation |
| **P2** | P1 stable | `spine agent follow --lane N` (journal tail filter) sharing SP-361 code path | #52 CLI |
| **P3** | SP-367 lane detail panel | Dashboard lane SSE channel reading same store; loopback only | #52 UI |
| **Optional** | FR-SHIP-11 pilot pain | Minimal supervisor **health** nudges only — separate epic | FR-SHIP-11 stretch |

**Do not start P1 until:**

1. Phase 46 waves 0–3 are on `main` and runbook §Monitor documents Tier 1–2.
2. At least one real-pi consumer pilot documents whether live worker log (SP-365) closed the observability gap.
3. Config keys and journal event taxonomy are reviewed for rebuild exclusion (structural rebuild FR-SHIP-10).

## Open questions

1. **agentSession vs subprocess:** In-process pi exposes richer event hooks than stdout-only subprocess — should Tier 3 be agentSession-only initially?
2. **Event schema versioning:** Add `schemaVersion` on agent journal events for forward-compatible export?
3. **Retention:** Per-batch agent jsonl vs single journal — archive policy on `spine batch complete`?
4. **MCP bridge:** Cursor SDK tool boundaries (pi worker sessions) may not map 1:1 to pi TUI tool names — document normalization layer?

## Related artifacts

| Doc | Role |
|-----|------|
| [PRD §4.2](../docs/PRD.md) | Non-goals: deterministic LLM/tool replay |
| [PRD §16.3](../docs/PRD.md) | Dashboard non-goals: remote access, analytics |
| [PRD v2.2 FR-SHIP-11](../docs/PRD-v2.2-ship-readiness-handoff.md#fr-ship-11-design-decision) | Supervisor defer |
| [Operator runbook §Monitor](../docs/adoption/operator-runbook.md) | Tier 1–2 commands; deferred Tier 3 pointer |
| SP-361, SP-365, SP-367 packets | Immediate epic scope |

## Exit criteria for this explore task

- [x] Design options documented with tradeoffs
- [x] Security, volume, redaction, NFR-OBS-04 constraints captured
- [x] Phasing recommendation after SP-360–367
- [x] Runbook deferred pointer (SP-368 Step 2)
- [ ] Implementation — explicitly out of scope for v2.2 / Phase 46
