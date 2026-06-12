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

## Resolved — Worker wedge epic (SP-190, batch `20260611T222221`)

**Symptom:** Task work complete (`.DONE`, commit `b4807d1`) but batch `running` 17+ minutes; pi child PID hung at 0% CPU.

**Root cause chain:**
1. **Trigger:** RL2 worker called `spine_review_step` → `spawnReviewerPi()` nested `spawnSync("pi")` hung after work completed.
2. **Wedge:** `worker-host.mjs` waited indefinitely for `exitCode === 0` after `.DONE`.

**Fix epic (SP-193–198):** post-done grace (SP-193), nested spawn guard (SP-194), engine code review (SP-195), worker prompt delegation (SP-196), SP-190 fixture regression (SP-197), capstone tracking (SP-198).

**Tests:** `tests/batch/worker-post-done-grace.test.mjs`, `tests/batch/worker-wedge-incident.test.mjs`, `tests/fixtures/batch-state/sp-190-wedge-hang.json`.

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

## Resolved (SP-195)

**Incident:** SP-190 (RL2) — worker nested `spine review step` code review hung; engine never reached lane commit.

**Fix:**
1. **Engine code review phase** — `runCodeReviewPhase()` in `engine-lanes.mjs` after worker success, before final review.
2. **Honor worker verdicts** — `findCompletedCodeReview()` mirrors `findCompletedFinalReview` for journal/artifact APPROVE.
3. **REVISE rework** — re-invokes worker on code review REVISE (same pattern as final review).

**Tests:** `tests/batch/engine-code-review.test.mjs`.

## Resolved (SP-199)

**Incident:** Batch `20260611T225006` — SP-193 lane passed implementation but `contract.verified` failed with `no matching changes for see File Scope`, `missing —`, and unparseable coverage. Engine recorded unnecessary REVISE rework.

**Root cause:** Phase 22 packet generator and legacy PROMPT contract tables used literal `see File Scope` and em-dash (`—`) cells. `parseContract()` treated those as real glob patterns before the hotfix; `verifyContract()` then compared git diffs against non-path tokens.

**Fix:**
1. **Parser** — `parseContract()` resolves `see File Scope` to File Scope bullets and treats em-dash cells as empty (hotfix on `main`; regression tests in `tests/tasks/contract-parse.test.mjs`).
2. **Validate guard** — `validateContract()` errors in `required` mode when raw contract tables still contain unresolved placeholders (`detectContractPlaceholderIssues()`).
3. **Generator** — `scripts/generate-phase22-packets.mjs` emits concrete paths or empty cells.
4. **Packet migration** — Bulk-updated `spine-tasks/SP-*` contract tables to concrete paths / empty cells.

**Tests:** `tests/tasks/contract-parse.test.mjs`, `tests/batch/contract-verify.test.mjs` (SP-193-shaped fixture).

## Resolved (SP-202)

**Incident:** Batch `20260612T023712` — SP-195/SP-199 failed with `pi worker timed out` (exit 124) ~66m; salvage found uncommitted work.

**Root cause:** `spine-worker-runner.mjs` capped `spawnSync(pi)` at 60m while M-task stall budget is 180m; `worker-host` never passed stall-derived timeout to child env.

**Fix:**
1. **`resolveWorkerPiTimeoutMs`** — derives pi timeout from per-task stall minutes (`task-stall-budget.mjs`).
2. **`buildWorkerChildEnv`** — sets `SPINE_WORKER_PI_TIMEOUT_MS` for the runner child unless parent env overrides.
3. **Doctor** — `buildPiWorkerTimeoutDoctorCheck` reports alignment for real-pi runs.

**Tests:** `tests/batch/worker-pi-timeout.test.mjs`.

## Resolved (SP-203)

**Incident:** Batch `20260612T011148` — orphaned detached engine stuck in final `spawnSync(pi)`; resume raced with in-flight review; `review.failed` after `batch.completed`.

**Fix:**
1. **`terminateStaleDetachedEngine`** — SIGTERM/SIGKILL stale `enginePid` on resume (`resume-engine.mjs`).
2. **`runStepReview`** — honors existing final PASS; skips `review.failed` journal when batch phase is `completed`/`dismissed`.

**Tests:** `tests/batch/engine-review-orphan.test.mjs`.

## Resolved (SP-204)

**Incident:** Batch `20260612T011148` — all lanes merged, phase `running`, `integrate` blocked (no gate).

**Fix:**
1. **`isPostMergeLimbo`** — detects merge-complete + all tasks succeeded while phase still `running`.
2. **Reconcile** — diagnoses `needs_integrate` with `spine batch resume` when post-merge limbo.
3. **Resume fast path** — `finalizeResumedBatchForIntegrate` opens gate without re-running tasks (idempotent gate).

**Tests:** `tests/batch/post-merge-limbo.test.mjs`.

## Open — Stress test hotfixes (SP-205–225 epic, 2026-06-12)

**Outcome:** Waves 0–5 landed (SP-205–211). Wave 6 (SP-214) **blocked**; batch `20260612T204048` force-dismissed (gate rejected — stub `.DONE` only).

| Pattern | Batch / task | Staged fix |
|---------|--------------|------------|
| Preflight `git-clean` fails on rules-manifest `generatedAt` only | Waves 1+ after integrate | **SP-227** |
| Attached `--attached` exits after merge without gate open | `20260612T195913` (SP-210) | **SP-228** |
| `worker_orphaned` during engine final review despite worktree `.DONE` | `20260612T193902` (SP-209), `20260612T202559` (SP-211) | **SP-229** |
| Stub retry marks exit task Done without contract/fileScope | `20260612T204048` (SP-214) | **SP-230** |
| §8 Phase 23 audit not runnable; CONTEXT still Staged; 5× `batch/*.mjs` >500 LOC | SP-214 manual audit | **SP-231** |

**Recovery:** Land SP-227–231, then re-run SP-214 with real pi after `verify phase23-exit` green.

## Open — Real-pi model inheritance (SP-232, 2026-06-12)

**Pattern:** `agents.worker.model: inherit` + worker runner never passes `--model` → pi uses global selection (`pi-lmstudio` → `http://127.0.0.1:1234`, e.g. `qwen/qwen3-coder-next`). Spine doctor shows `cursor/auto` from pi defaults; batch workers hit LM Studio anyway.

| Batch | Symptom | Fix |
|-------|---------|-----|
| `20260612T211613` (SP-214) | `Model unloaded` / MLX backend missing `libpython3.11.dylib` | **SP-232** — pin `cursor/auto` via spine-config + worker runner |
| `20260612T215847` (SP-215–219) | Engine code review spawn failed on same LM Studio model | **SP-232** — reviewer pin parity + runbook |

**Option A (task scope):** Honor `agents.worker.model` / `agents.reviewer.model` in pi spawn argv; template defaults `cursor/auto`; document `inherit` risks.
