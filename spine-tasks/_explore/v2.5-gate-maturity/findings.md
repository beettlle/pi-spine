# Explore findings — v2.5 gate maturity

**Status:** complete  
**Date:** 2026-07-12  
**Slug:** `v2.5-gate-maturity`  
**PRD:** [`docs/PRD-v2.5.0-gate-maturity-handoff.md`](../../../docs/PRD-v2.5.0-gate-maturity-handoff.md)

## Summary

Gate maturity work centers on [`src/batch/gate.mjs`](../../../src/batch/gate.mjs) and leaf readers in [`src/batch/gate-evidence-read.mjs`](../../../src/batch/gate-evidence-read.mjs). No `targetRevision`, posture, or structured blocker types exist yet. Auto-approve today is a blunt sequence flag gated by [`src/doctor/sequence-safety.mjs`](../../../src/doctor/sequence-safety.mjs).

## Codebase areas

| Area | Finding |
|------|---------|
| Gate open | `openIntegrateGate` builds `{ gateId, batchId, kind: "integrate", status: "pending", openedAt, evidenceRefs, summary }` — natural place to add `targetRevision` + `category` |
| Gate approve | `approveIntegrateGate` sets `status=approved`, `decidedBy=human` — wire posture auto here / land-loop |
| Gate check | `checkIntegrateGate` fail-closed on missing/pending/rejected — add revision mismatch + structured blockers |
| Scorecard | `buildTaskScorecard` is markdown-only free text — not the primary blocker surface; prefer gate check JSON |
| Land loop | `runSequenceWaveLandLoop` + `autoApproveGate` boolean — keep sequence-safety; posture overlay must not bypass release lock |
| Revision | No existing counter; **pin `targetRevision` to orch tip SHA** at open (`batchState.orchBranch` via `git rev-parse`), or a new `batchState.resourceRevision` integer incremented on material state writes — prefer orch tip SHA for S scope (no state schema migration) |

## Suggested file scopes

| Task | Primary paths |
|------|---------------|
| SP-623 | `src/batch/gate.mjs`, helper maybe `src/batch/gate-revision.mjs`, `tests/batch/gate-target-revision*.test.mjs` |
| SP-624 | `src/batch/gate.mjs`, `src/batch/integrate.mjs` (if check path), same tests family |
| SP-625 | `src/batch/blocker-codes.mjs`, `tests/batch/blocker-codes.test.mjs` |
| SP-626 | `src/batch/gate.mjs` (after SP-624 or serialize), blocker import |
| SP-627 | `src/batch/gate-posture-defaults.mjs`, tests |
| SP-628 | `src/batch/gate-posture-evaluate.mjs`, tests |
| SP-629 | `src/config/` posture load helpers + spine-config schema docs in comments/tests |
| SP-630 | `src/batch/gate.mjs` stamp `category` (after SP-624) |
| SP-631 | streak store under `.spine/runtime/` or config-adjacent module |
| SP-632 | `gate.mjs` + `sequence-wait.mjs` + sequence-safety coexistence tests |
| SP-633 | `docs/adoption/operator-runbook.md` |
| SP-634 | `spine-tasks/CONTEXT.md` |

## Risks

- Parallel edits to `gate.mjs` (SP-623/624/626/630/632) — **serialize** via dependencies  
- Accidental auto-approve of integrate without config — default locked  
- `#122` codes must not break CLI string headlines  

## Open questions (resolved for authoring)

| Question | Decision |
|----------|----------|
| Revision source | Orch tip SHA at gate open; fail closed if unreadable |
| Blocker primary surface | `checkIntegrateGate` / approve returns; scorecard optional later |
| Integrate default category | `execute` or `write` mapped to **locked** posture until config opts in |
