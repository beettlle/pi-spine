# Reliability epic explore findings

**Date:** 2026-06-11  
**Slug:** `reliability-epic`  
**Source:** Phase 22 plan, SP-106 audit, consumer incidents

## Summary

pi-spine orchestration logic is sound (699 stub tests, Phase 21 remediation landed). Reliability gaps are **validation depth** (no real-pi CI), **dual-source truth** (batch-state vs journal), and **operator UX** (detached defaults). Phase 22 targets journal rebuild, atomic transitions, real-pi proof, and agentSession hardening.

## Codebase areas

| Area | Touch points | Risk |
|------|--------------|------|
| Journal rebuild | `src/batch/journal.mjs`, new `journal-rebuild.mjs` | High — state correctness |
| Drift detect | `src/batch/reconcile.mjs`, `diagnosis.mjs` | High |
| Atomic writes | `src/batch/state.mjs`, `retry.mjs`, `engine-lanes.mjs` | High |
| Real-pi CI | `.github/workflows/`, `scripts/real-pi-adoption-e2e.sh` | Medium — needs pi + API |
| agentSession | `agent-session-worker.mjs`, `worker-backend.mjs` | Medium |
| Doctor | `bin/spine-doctor.mjs`, new `worktree-health.mjs` | Low |
| Detached resume | `detached-start.mjs`, `bin/spine-cli/batch.mjs` | Medium |

## Incident classes (covered vs open)

| Pattern | Fixture | Status |
|---------|---------|--------|
| Orphan running | `orphan-running-resume.json` | Covered SP-082/111 |
| Parallel lane resume | `resume-parallel-lane-orphan.json` | Covered SP-096 |
| Retry state drift | retry-state-drift test | Covered SP-120; needs atomic helper |
| Devcontainer launch | `lane-worktree-devcontainer.json` | Covered SP-101–105 |
| Journal/cache drift | — | **Open** — Phase 22 |
| Real-pi regression | AD-002 only | **Open** — Phase 22 |

## Suggested file scopes per wave

- **Wave B:** `src/batch/journal-rebuild.mjs`, `tests/batch/journal-rebuild.test.mjs`
- **Wave C:** `src/batch/state.mjs`, `tests/batch/state-transition.test.mjs`
- **Wave D:** `.github/workflows/real-pi.yml`, `tests/fixtures/adoption-repo/`
- **Wave E:** `src/batch/agent-session-worker.mjs`, `bin/spine-doctor.mjs`
- **Wave F:** `src/batch/detached-start.mjs`, `docs/adoption/operator-runbook.md`

## Open questions

- Real-pi CI requires API credentials — use `workflow_dispatch` + weekly cron with secrets documented
- Journal rebuild seeds structural fields from cache; full structural rebuild deferred v2.2
