# Incident Report: Lane worktree devcontainer batch `20260605T160800`

**Date:** 2026-06-05  
**Orchestrator:** pi-spine multi-lane batch (searchATon Wave 9)  
**Repo:** searchATon (consumer)  
**Outcome:** Entire wave failed at worker launch — broken lane worktree gitdir, missing `PI_SPINE_ROOT` in devcontainer launch path; `spine status --diagnose` returned generic `needs_retry`  
**Fix tasks:** SP-101 (relative gitdir), SP-102 (`worktreeSetupHook`), SP-103 (`PI_SPINE_ROOT` env), SP-104 (scoped lane commit), SP-105 (launch failure diagnosis — this doc)

This document captures the searchATon consumer incident where lane worktrees and devcontainer mounts prevented workers from launching. It complements [`20260604-resume-parallel-lane-orphan.md`](20260604-resume-parallel-lane-orphan.md), which covered a later resume/orphan failure on batch `20260603T224829` after the same root launch misconfiguration.

---

## Executive summary

searchATon batch `20260605T160800` started a two-lane wave inside a devcontainer. Lane worktrees were provisioned with **container-absolute** `.git` gitdir pointers that broke `git status` on host-mounted lane directories. The custom `workerLaunchScript` could not resolve pi-spine tooling because **`PI_SPINE_ROOT` was unset** in the worker child env. Every task failed during the **launching** phase before `pi` started. Operators saw only generic retry guidance until SP-105 surfaced launch-failure headlines and `spine doctor` suggestions.

---

## Timeline

| Time (approx) | Event |
|---------------|-------|
| T+0 | `batch.started` — two lanes provisioned in devcontainer |
| T+10s | `lane.setup_hook.failed` on lane 1 — worktree gitdir still points at `/workspace/...` |
| T+15s | `task.failed` SAT-047 — worker output: worktree git unhealthy |
| T+20s | `task.failed` SAT-048 — worker output: `CONFIG_PI_SPINE_ROOT_MISSING` |
| T+25s | `batch.failed` — wave stops with zero succeeded tasks |
| T+operator | `spine status --diagnose` → generic `needs_retry` (pre-SP-105) |
| T+fix | SP-101–104 harden worktrees/env/commit; SP-105 diagnosis cites launch root cause |

---

## Root causes

| # | Symptom | Root cause | Fix task |
|---|---------|------------|----------|
| 1 | `git status` fails in lane worktree on host | Absolute container gitdir in lane `.git` file | **SP-101** — normalize to relative gitdir + resume repair |
| 2 | Devcontainer hook artifacts missing on lane mount | Lane-only bind mounts omit parent-repo paths | **SP-102** — `worktreeSetupHook` recreates expected symlinks |
| 3 | Launch script cannot find `spine-worker-runner.mjs` | Worker env lacked `PI_SPINE_ROOT` | **SP-103** — set in `buildWorkerChildEnv` |
| 4 | Lane commit masks dirty worktree | `git add -A` + commit before terminal task state | **SP-104** — scoped dirty filter + ordering |
| 5 | Diagnose hides infra vs task failure | Reconcile ignored launch output hints | **SP-105** — `inferLaunchFailureKind` + headlines |

---

## Journal tail (launch failure pattern)

```
batch.started
lane.setup_hook.failed   lane-1   worktree gitdir /workspace/...
task.failed              SAT-047  phase launching; worktree unhealthy
task.failed              SAT-048  phase launching; CONFIG_PI_SPINE_ROOT_MISSING
batch.failed             all tasks failed at worker launch
```

Replay fixture: [`tests/fixtures/incidents/lane-worktree-devcontainer.json`](../../tests/fixtures/incidents/lane-worktree-devcontainer.json)

Automated regression: `tests/batch/diagnosis-launch-failed.test.mjs`

---

## Batch-state snapshot

| Field | Value | Problem |
|-------|-------|---------|
| `phase` | `failed` | Expected after full-wave launch failure |
| `failedTasks` | 2 | SAT-047, SAT-048 |
| `tasks[].exitReason` | `failed` | Worker died before `.DONE`; no lane commit attempted |
| Journal `task.failed` | `workerPhase: launching` | Failure before `pi` phase |
| Worker output | `PI_SPINE_ROOT` / git errors | Infra misconfig, not task logic |

---

## Recovery procedure

1. `spine status --diagnose` — expect headline **failed at worker launch — fix PI_SPINE_ROOT/devcontainer, then retry** (SP-105).
2. `spine doctor` — verify `development.piSpineRoot` and `workerLaunchScript` (SP-103).
3. Repair lane worktrees: `git status` must succeed in each lane path (SP-101); run `worktreeSetupHook` if configured (SP-102).
4. `spine batch retry <taskId>` only after infra fixes — mixed-outcome waves list per-task retry lines (SP-105 `formatMixedOutcomeMessage`).
5. Never hand-edit `.spine/batch-state.json`.

See [operator runbook § Launch failures](../adoption/operator-runbook.md) and prior incident [`20260604-resume-parallel-lane-orphan.md`](20260604-resume-parallel-lane-orphan.md).

---

## Traceability

| Requirement | Location |
|-------------|----------|
| FR-BATCH-13 diagnosis taxonomy | `src/batch/diagnosis.mjs` |
| Launch failure inference | `inferLaunchFailureKind`, `deriveDiagnosis` in `src/batch/reconcile.mjs` |
| Journal hint priority | `extractJournalDiagnosisHints` in `src/batch/journal.mjs` |
| Mixed-outcome messaging | `formatMixedOutcomeMessage` in `src/batch/engine-scope.mjs` |
| SP-101–104 fixes | worktree gitdir, hook, `PI_SPINE_ROOT`, lane commit |
| SP-105 fixture + doc | This file + `lane-worktree-devcontainer.json` |

---

## Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-05 | Initial report + replay fixture (SP-105) |
