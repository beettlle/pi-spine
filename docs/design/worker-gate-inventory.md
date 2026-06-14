# Worker manual gate inventory (FR-SHIP-13 phase 1)

**Status:** Inventory complete — decision recorded for SP-224  
**Related:** [PRD §12 Human gates](../PRD.md#12-human-gates-specification), [FR-SHIP-13](../PRD-v2.2-ship-readiness-handoff.md#fr-ship-13--worker-manual-gate), `src/worker-tools/request-gate.mjs`

## Question

Which gate kinds should `spine_request_gate` support in v2.2, versus return structured `not_supported`?

## Gate kinds in PRD §12.1

| Kind | Trigger (PRD) | Implemented in code | Worker tool behavior today |
|------|---------------|---------------------|----------------------------|
| `integrate` | Batch `completed` | **Yes** — `openIntegrateGate`, auto-open after batch complete/resume (SP-204) | `not_supported` (`limitation: integrate-only`) — operator-managed; gate opens automatically |
| `manual` | Operator `/spine-gate open` | **No** — no `openManualGate`, no CLI open path, no gate record writer for `kind: manual` | `not_supported` (`limitation: manual-gate-deferred`) |
| `conflict` | Integrate merge conflict (FR-INT-03) | **No** — integrate aborts merge and journals `integrate.failed`; no `kind: conflict` gate record | Would hit `manual-gate-deferred` path (no record or non-integrate record) |

## Worker tool registration (TP-038)

`registerSpineWorkerTools` registers three PRD §14.5 tools:

- `spine_review_step`
- `spine_report_progress`
- `spine_request_gate` — thin wrapper over `requestWorkerGate()` in `src/worker-tools/request-gate.mjs`

Tool description and guidelines already state v1.1 limitation: integrate gates are automatic; worker manual gate requests return `not_supported` with `suggestedCommand: spine gate`.

## `spine_request_gate` supported vs not_supported

| Gate kind | Supported by worker tool? | Rationale |
|-----------|---------------------------|-----------|
| `integrate` | **not_supported** | Gate is engine/operator lifecycle — opens at batch completion; worker cannot approve. Operator uses `spine gate status` / `spine gate approve`. |
| `manual` | **not_supported** | No gate API to open or refresh a manual gate from worker context. PRD `/spine-gate open` is unimplemented. |
| `conflict` | **not_supported** | Conflict gate FSM not implemented; integrate fail-closed abort is the shipped path (see [integrate-conflict-recovery.md](./integrate-conflict-recovery.md)). |

**Supported kinds for worker-initiated gate open/refresh: none.**

The tool remains registered so workers get a structured, actionable response (`notSupported`, `limitation`, `suggestedCommand`, `alternatives`) instead of hallucinating bash or blocking silently.

## Runbook / operator references

Gate kinds appear in operator-runbook land-loop and integrate-conflict sections (`spine gate approve`, `spine gate reject`, stall diagnosis). Runbook does **not** document worker-initiated gates — consistent with permanent `not_supported`.

Worker template (`.spine/agents/worker.md`, `templates/agents/worker.md`): `spine_request_gate` marked rare; v1.1 returns `not_supported`; integrate gates automatic.

## Decision for SP-224 (FR-SHIP-13 phase 2)

**Document permanent `not_supported`** — do not wire worker-initiated gate open in v2.2.

| Action | Owner |
|--------|-------|
| Keep `requestWorkerGate()` behavior (structured `not_supported` for all kinds) | SP-224 |
| Document limitation in operator runbook (worker tool section + operator workaround) | SP-224 |
| Document limitation in README worker-tools / gates section | SP-224 |
| Confirm tool description/guidelines in `extensions/spine/worker-tools.ts` match decision | SP-224 |

**Operator workaround:** When a worker needs human attention, the worker should finish the step, update STATUS, and rely on batch stall detection or operator monitor — not gate open. For integrate approval, operator runs from host: `spine gate approve` (or `/spine-gate approve` in pi).

**Defer to post-v2.2 (optional):** Implement `manual` gate open via operator CLI first; only then consider whether workers may *signal* (not open) a manual gate via journal event — out of scope for ship.

## Why not implement minimal kinds now?

1. **Integrate** — Wrong actor: workers must not approve or refresh integrate gates; engine already opens them.
2. **Manual** — Requires new gate FSM + CLI (`/spine-gate open`) before worker tool can delegate; no partial API exists.
3. **Conflict** — FR-INT-03 conflict gate is PRD-only; shipped UX is runbook manual git recovery (SP-223).
4. **Ship risk** — Wiring worker gate open without operator CLI creates false confidence (tool appears to work but gate record APIs are integrate-only).
