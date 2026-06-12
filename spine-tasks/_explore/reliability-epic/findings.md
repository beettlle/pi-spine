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
| Real-pi regression | AD-002 only | **Resolved SP-192** — engine honors worker `review.completed` final PASS; E2E re-run pending |

## Suggested file scopes per wave

- **Wave B:** `src/batch/journal-rebuild.mjs`, `tests/batch/journal-rebuild.test.mjs`
- **Wave C:** `src/batch/state.mjs`, `tests/batch/state-transition.test.mjs`
- **Wave D:** `.github/workflows/real-pi.yml`, `tests/fixtures/adoption-repo/`
- **Wave E:** `src/batch/agent-session-worker.mjs`, `bin/spine-doctor.mjs`
- **Wave F:** `src/batch/detached-start.mjs`, `docs/adoption/operator-runbook.md`

## Open questions

- Real-pi CI requires API credentials — use `workflow_dispatch` + weekly cron with secrets documented
- Journal rebuild seeds structural fields from cache; full structural rebuild deferred v2.2

## Resolved (SP-192)

**Incident:** Batch `20260611T220521` — worker journal showed final **PASS** and `.DONE`, engine recorded `final_review_spawn_failed`.

**Fix (4907ed5):** `findCompletedFinalReview()` honors journal `review.completed` or `.reviews/final-*.md` PASS before engine spawn; non-stub path delegates to `runStepReview({ reviewType: "final" })`.

## Resolved (SP-194)

**Incident:** SP-190 worker log — `spine review step` hung on nested `spawnSync("pi")` reviewer inside active worker session.

**Fix:** `spawnReviewerPi()` checks `isActiveWorkerSession()` (`SPINE_WORKER_RUNNER` set by `buildWorkerChildEnv`) and fails fast with `spawnFailed: true`, journal `review.failed` reason `nested_spawn_blocked`, and tool message directing workers to skip in-worker code review (engine runs code review in SP-195). Stub plan review path unchanged for CI.

## Open — Worker wedge (SP-190, batch `20260611T222221`)

**Symptom:** Task work complete (`.DONE`, commit `b4807d1`) but batch `running` 17+ minutes; pi child PID hung at 0% CPU.

**Root cause chain:**
1. **Trigger:** RL2 worker called `spine_review_step` → `spawnReviewerPi()` nested `spawnSync("pi")` hung after work completed.
2. **Wedge:** `worker-host.mjs` breaks poll loop on `.DONE` (disables stall/heartbeats) then `await childDone` indefinitely; success requires `exitCode === 0`.

**Staged fix epic:** SP-193 (post-done grace + kill), SP-194 (nested spawn guard), SP-195 (engine code review), SP-196 (worker prompt), SP-197 (fixture), SP-198 (capstone).

## Resolved (SP-193)

**Fix:** `runWorker()` no longer breaks the poll loop on `.DONE`. A configurable post-done grace window (`lanes.postDoneGraceMinutes`, default 4 min) keeps polling; after grace the host SIGTERM/SIGKILLs a hung child and journals `worker.post_done_terminated`. When `.DONE` persists, the lane succeeds without requiring `exitCode === 0`. Pre-.DONE stall detection is unchanged.

## Resolved (SP-200)

**Incident:** Batch `20260611T225006` — detached resume reported `needs_integrate` but `gate.json` was missing until manual `openIntegrateGateAfterBatchComplete` (~2 min evidence collection).

**Fix:**
1. **Ordering** — `resume.mjs` and `resume-multi.mjs` call `openIntegrateGateAfterBatchComplete` *before* setting `phase: completed` and journaling `batch.completed`, so `gate.opened` precedes terminal batch events.
2. **Detached waiter** — `waitForDetachedBatchResume` in `detached-start.mjs` keeps polling until `gate.json` exists when `gates.requireBeforeIntegrate` is true, even if batch phase is already `completed`.

**Tests:** `tests/batch/resume-gate-open.test.mjs`, `tests/batch/detached-resume-gate.test.mjs`.

## Resolved (SP-201)

**Incident:** Batch `20260611T225006` land loop — `spine integrate` aborted because evidence collection left a dirty `.spine/rules-manifest.json` on `main` (only `generatedAt` differed from orch).

**Fix:**
1. **Pre-merge drift** — `resolveRulesManifestIntegrateDrift()` in `engine-lanes.mjs` restores HEAD manifest when working tree has generatedAt-only drift, unblocking `git merge`.
2. **Merge conflict** — `integrateOrchToBase` reuses `tryAutoResolveRulesManifestMergeConflict()` for stage-2/3 generatedAt conflicts (same policy as lane→orch merge).

**Tests:** `tests/batch/integrate-rules-manifest.test.mjs`.

## Resolved (SP-199)

**Incident:** Batch `20260611T225006` — SP-193 lane passed implementation but `contract.verified` failed with `no matching changes for see File Scope`, `missing —`, and unparseable coverage. Engine recorded unnecessary REVISE rework.

**Root cause:** Phase 22 packet generator and legacy PROMPT contract tables used literal `see File Scope` and em-dash (`—`) cells. `parseContract()` treated those as real glob patterns before the hotfix; `verifyContract()` then compared git diffs against non-path tokens.

**Fix:**
1. **Parser** — `parseContract()` resolves `see File Scope` to File Scope bullets and treats em-dash cells as empty (hotfix on `main`; regression tests in `tests/tasks/contract-parse.test.mjs`).
2. **Validate guard** — `validateContract()` errors in `required` mode when raw contract tables still contain unresolved placeholders (`detectContractPlaceholderIssues()`).
3. **Generator** — `scripts/generate-phase22-packets.mjs` emits concrete paths or empty cells.
4. **Packet migration** — Bulk-updated `spine-tasks/SP-*` contract tables to concrete paths / empty cells.

**Tests:** `tests/tasks/contract-parse.test.mjs`, `tests/batch/contract-verify.test.mjs` (SP-193-shaped fixture).

## Open — Pi timeout mismatch (batch `20260612T023712`)

**Symptom:** SP-195/SP-199 failed with `pi worker timed out` (exit 124) ~66m; salvage found uncommitted work.

**Root cause:** `spine-worker-runner.mjs` caps `spawnSync(pi)` at 60m; M-task stall budget is 180m; `worker-host` never passes stall-derived timeout to child env.

**Staged fix:** SP-202.

## Open — Engine review orphan + post-merge limbo (batch `20260612T011148`)

**Symptom:** Merges complete, phase `running`, gate missing; resume completed batch then `review.failed` after `batch.completed`.

**Staged fix:** SP-203 (orphan engine + resume race), SP-204 (post-merge limbo auto-gate).
