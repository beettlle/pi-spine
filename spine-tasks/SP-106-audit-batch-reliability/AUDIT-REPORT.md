# SP-106 — Brutal audit: batch engine & reliability

**Date:** 2026-06-05  
**Scope:** `src/batch/**`, `src/worker-tools/**`, `tests/batch/**`, `tests/fixtures/incidents/**`, `docs/incidents/**`  
**Baseline:** Phases 11–19 (stall recovery, orphan/resume, devcontainer worktrees, launch diagnosis)

---

## Executive summary

pi-spine batch orchestration is **materially stronger** than pre–Phase 11: stall output capture, scoped orphan detection (SP-095), per-lane resume serialization (SP-096), engine crash fail-closed (SP-097), worktree gitdir normalization (SP-101), `PI_SPINE_ROOT` in worker env (SP-103), and launch-failure diagnosis (SP-105) are implemented and covered by **258 passing batch tests**.

Remaining risk is **maintainability and edge-case honesty**, not wholesale broken orchestration. God modules (`resume-multi.mjs` at 898 lines, `detached-start.mjs` at 694) survived SP-074's engine strangler. Orphan detection still has blind spots when neither `workerPid` nor `enginePid` is present. Operator docs (`spine-tasks/CONTEXT.md`, incident fixture README) lag **landed** Phase 19 code. The PROMPT baseline command `npm test -- tests/batch/` produces a spurious failure because npm appends a non-file path after the script already glob-includes batch tests.

### Cleanliness score: **6/10**

| Area | Score | Notes |
|------|-------|-------|
| Reliability / fail-closed | 8/10 | Orphan, stall, crash paths largely fixed; PID-less ghost gap |
| Test coverage | 8/10 | 258 batch tests; missing PID-less orphan + detached-start timeout regressions |
| Diagnosis UX | 7/10 | Launch failures surfaced; lane orphan still `needs_retry` |
| Module hygiene | 4/10 | 898-line resume-multi; circular state↔reconcile import |
| Docs / traceability | 5/10 | CONTEXT marks SP-101–105 "Staged"; fixture README lists 1/4 fixtures |

---

## Baseline verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** (exit 0) |
| `SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test -- tests/batch/` | **559 pass / 1 fail** — failure is `Cannot find module '…/tests/batch'` (npm appends directory as test entry; see Finding #8) |
| `node --test tests/batch/*.test.mjs` (correct invocation) | **258 pass / 0 fail** |

### Module size inventory (`src/batch/`)

| Lines | Module | God-file? |
|------:|--------|-----------|
| 898 | `resume-multi.mjs` | **Yes** — validation + lane queue + merge + crash handler |
| 694 | `detached-start.mjs` | **Yes** — spawn, wait, format, preflight |
| 602 | `worker-host.mjs` | Borderline |
| 600 | `reconcile.mjs` | Borderline — also owns `loadBatchStateFile` |
| 589 | `review.mjs` | Borderline |
| 568 | `engine-lanes.mjs` | Acceptable post-SP-074 split |
| 522 | `state.mjs` | Borderline — imports reconcile (cycle) |
| 454 | `resume.mjs` | Acceptable |
| 424 | `engine.mjs` | Improved post-SP-074 |

---

## Findings

### Finding 1 — Ghost `running` when both PIDs are absent

🚨 **[HIGH]**  
📍 `src/batch/orphan-detect.mjs`  
📝 Lines 115–145  
❌ **Issue:** `detectOrphanRunning` only flags orphan when (a) a running task's `workerPid` is finite and dead, or (b) `enginePid` is finite and dead. If batch-state shows `phase: running` with running tasks but **both PIDs missing/cleared** (corruption, partial write, or legacy state), the function returns `null` and reconcile diagnoses **`running`** — the exact false-positive class from searchATon `20260603T224829`.  
✅ **Fix:** Add a third signal: `phase === "running"` + scoped journal has no progress after `engineStartedAt`/`batch.resumed` + no live processes + tasks stuck `running` beyond stall budget → `engine_orphaned` or new `state_corrupt` diagnosis. Regression fixture + test required.  
⏱️ **Effort:** M (1–2 days)

---

### Finding 2 — Lane worker orphan mapped to generic `needs_retry`

🚨 **[MEDIUM]**  
📍 `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs`  
📝 `reconcile.mjs` 375–377; `diagnosis.mjs` 130–202  
❌ **Issue:** Dead **lane** `workerPid` returns diagnosis `needs_retry` (same bucket as salvage retry and segment drift), not a distinct orphan class. Headline says "worker died" (good) but taxonomy collapses infra stall/orphan with "retry task logic error." Operators cannot filter dashboards/alerts on orphan vs task failure.  
✅ **Fix:** Introduce `worker_orphaned` (or reuse `engine_orphaned` with `kind: lane`) in `DIAGNOSIS_TAXONOMY`; map lane orphan in `deriveDiagnosis`; update `buildSuggestedCommand` to prefer `spine batch abort` when multiple ghost running tasks on one lane.  
⏱️ **Effort:** S (4–8 hours)

---

### Finding 3 — `resume-multi.mjs` is an 898-line god module

🚨 **[HIGH]**  
📍 `src/batch/resume-multi.mjs`  
📝 Lines 1–898 (entire file)  
❌ **Issue:** SP-074 split `engine.mjs` / `engine-lanes.mjs` but **did not** apply the same strangler to multi-task resume. This file owns validation, worktree repair, per-lane serialization, worker spawn, salvage, wave merge, integrate gate, and crash handling — the highest-churn reliability surface after Phases 14–17.  
✅ **Fix:** Extract `resume-multi-validate.mjs`, `resume-multi-lanes.mjs`, and share merge helpers with `engine-lanes.mjs`. Target ≤350 lines per module.  
⏱️ **Effort:** M (2–3 days)

---

### Finding 4 — Circular dependency: `state.mjs` ↔ `reconcile.mjs`

🚨 **[MEDIUM]**  
📍 `src/batch/state.mjs`, `src/batch/reconcile.mjs`  
📝 `state.mjs` 8, 193; `reconcile.mjs` imports via `orphan-detect` → `state.mjs`  
❌ **Issue:** `assertNoActiveBatch` in `state.mjs` imports `loadBatchStateFile` from `reconcile.mjs`, while reconcile imports state readers and orphan detection that reads state. ESM load order has worked so far but this is a **load-order bomb** — any top-level side effect or test mock reorder can cause subtle init failures.  
✅ **Fix:** Move `loadBatchStateFile`, `resolveBatchStatePath`, and `parseBatchState` to `src/batch/batch-state-io.mjs` (or extend `readers/spine-state.mjs`). Both `state.mjs` and `reconcile.mjs` import from the leaf module only.  
⏱️ **Effort:** S (4–8 hours)

---

### Finding 5 — Detached **start** persists `enginePid` only after wait succeeds

🚨 **[MEDIUM]**  
📍 `src/batch/detached-start.mjs`  
📝 Lines 547–581 vs 639–640 (resume path)  
❌ **Issue:** Asymmetric persistence: `resumeBatchDetached` calls `persistDetachedEnginePid` **immediately** after spawn (line 640), but `startBatchDetached` persists **only after** `waitForDetachedBatchStart` succeeds (line 581). The child engine writes PID at `engine.mjs:163`, so the common path is OK, but on **`timeout_waiting_for_batch`** the CLI returns "Engine may still be running or orphaned" while parent never redundantly persisted PID. Race: engine dies after writing `phase: running` but before `recordBatchEnginePid` → orphan detect misses dead engine (Finding #1 variant).  
✅ **Fix:** Persist parent-spawned `enginePid` immediately on spawn (mirror resume), or block `phase: running` until `resilience.enginePid` is written. Add integration test for timeout + dead engine diagnosis.  
⏱️ **Effort:** S (4–8 hours)

---

### Finding 6 — Silent git inspection failures in reconcile

🚨 **[MEDIUM]**  
📍 `src/batch/reconcile.mjs`  
📝 Lines 276–301  
❌ **Issue:** `inspectGitState` swallows git errors in empty `catch` blocks when counting commits ahead and scanning merged branches. A transient git failure yields `orchMergedToBase: false` and may surface **`needs_integrate`** or **`limbo_stale`** instead of an explicit git error — operator chases wrong command.  
✅ **Fix:** Log structured warning to journal hints or set `signals.gitInspectionError`; add diagnosis branch `git_unavailable` with `spine doctor` suggestion. Never empty-catch without surfacing.  
⏱️ **Effort:** S (4–8 hours)

---

### Finding 7 — Incident fixture README documents 1 of 4 fixtures

🚨 **[LOW]**  
📍 `tests/fixtures/incidents/README.md`  
📝 Lines 5–9  
❌ **Issue:** README table lists only `orphan-running-resume.json`. Landed fixtures `resume-parallel-lane-orphan.json`, `resume-orphan-historical-failure.json`, and `lane-worktree-devcontainer.json` (SP-098, SP-105) are undocumented — new contributors cannot discover replay patterns.  
✅ **Fix:** Expand table with batch ID, pattern, test file for all four fixtures; link incident docs.  
⏱️ **Effort:** XS (< 1 hour)

---

### Finding 8 — `npm test -- tests/batch/` baseline command is broken

🚨 **[LOW]**  
📍 `package.json`  
📝 Line 32 (`test` script)  
❌ **Issue:** Script already includes `tests/batch/*.test.mjs`. Appending `-- tests/batch/` makes Node try to execute the directory as a test module → 1 spurious failure in full suite (559/560 pass observed). Audit baselines and CI docs that cite this command will report false red.  
✅ **Fix:** Add `"test:batch": "… node --test tests/batch/*.test.mjs"` script, or document `node --test tests/batch/*.test.mjs` in PROMPT/runbook; optionally filter directory args in a thin test runner wrapper.  
⏱️ **Effort:** XS (< 1 hour)

---

### Finding 9 — `spine-tasks/CONTEXT.md` stale: Phase 19 marked "Staged" but code landed

🚨 **[MEDIUM]**  
📍 `spine-tasks/CONTEXT.md`  
📝 Lines 295–312 (Phase 19 table)  
❌ **Issue:** SP-101–105 are listed **Staged**, yet `src/batch/worktree.mjs` (gitdir normalization), `src/config/worktree-setup-hook.mjs`, `worker-host.mjs` (`PI_SPINE_ROOT`), `lane-commit.mjs` (scoped porcelain), and `diagnosis.mjs` (launch taxonomy) are on `main` with passing tests (`worktree-git-paths.test.mjs`, `diagnosis-launch-failed.test.mjs`, etc.). Operators following CONTEXT may re-implement or skip verification.  
✅ **Fix:** Mark SP-101–105 **Done** in CONTEXT; add land dates; close Phase 19 in priority backlog (SP-059 still staged is separate).  
⏱️ **Effort:** XS (< 1 hour, docs-only)

---

### Finding 10 — Agent session worker swallows abort errors

🚨 **[LOW]**  
📍 `src/batch/agent-session-worker.mjs`  
📝 Line 277  
❌ **Issue:** `void session.abort().catch(() => {})` silently discards abort failures during stall kill. Fail-closed elsewhere; here a stuck session may leave zombie resources with no journal signal.  
✅ **Fix:** Journal `lane.worker_abort_failed` with error message; or rethrow after logging.  
⏱️ **Effort:** XS (1–2 hours)

---

### Finding 11 — `deriveDiagnosis` launch context not applied for live orphan `needs_retry`

🚨 **[MEDIUM]**  
📍 `src/batch/reconcile.mjs`  
📝 Lines 375–377, 407–408  
❌ **Issue:** Lane orphan path calls `withFailureContext("needs_retry", …)` which **does** run `inferLaunchFailureKind`, but orphan running tasks often have **no** `task.failed` journal yet — launch hints never fire and headline falls back to generic "worker died." Acceptable for worker stall; indistinguishable from launch failure when worker dies in `launching` phase without persisted `exitReason` on task row.  
✅ **Fix:** When orphan kind is `lane` and scoped journal shows last `task.started` without terminal, inspect lane heartbeat / worker output log tail (FR-STALL-01 artifact) before default headline.  
⏱️ **Effort:** S (1 day)

---

### Finding 12 — No E2E test for detached-start timeout → diagnose orphan

🚨 **[MEDIUM]**  
📍 `tests/batch/detached-start.test.mjs`  
📝 (gap — no test matching `timeout_waiting_for_batch` + dead engine reconcile)  
❌ **Issue:** Detached start documents orphan hint string (line 563–564) but tests cover happy path and enginePid persistence, not reconcile after timeout with dead engine and stale `running` phase.  
✅ **Fix:** Fixture: spawn stub engine that sets `phase: running`, dies without terminal journal; assert `reconcileBatch` ≠ `running`.  
⏱️ **Effort:** S (4–8 hours)

---

## Cross-reference: incident classes vs coverage

| Incident / Phase | Fixture | Automated test | Gap |
|------------------|---------|----------------|-----|
| SP-082 orphan running (`20260603T185308`) | `orphan-running-resume.json` | `orphan-reconcile.test.mjs` | Covered |
| SP-095 historical terminal scope | `resume-orphan-historical-failure.json` | `orphan-detect-scope.test.mjs` | Covered |
| SP-096/097 parallel lane resume (`20260603T224829`) | `resume-parallel-lane-orphan.json` | `orphan-reconcile.test.mjs`, `resume-multi-sequential.test.mjs` | Covered |
| SP-056–060 stall (SAT-020) | `tests/fixtures/stall-sat020/` | `stall-sat020-integration.test.mjs`, salvage tests | Covered |
| SP-101–105 devcontainer launch (`20260605T160800`) | `lane-worktree-devcontainer.json` | `diagnosis-launch-failed.test.mjs`, `worktree-git-paths.test.mjs` | Covered for diagnosis; no full multi-lane launch E2E |
| PID-less ghost running | — | — | **Missing** (Finding #1) |
| Detached start timeout orphan | — | — | **Missing** (Finding #12) |

---

## Top 10 files / modules needing attention

| Rank | Module | Lines | Primary concern |
|------|--------|------:|-----------------|
| 1 | `src/batch/resume-multi.mjs` | 898 | God file; highest regression risk |
| 2 | `src/batch/detached-start.mjs` | 694 | God file; enginePid asymmetry |
| 3 | `src/batch/reconcile.mjs` | 600 | Diagnosis + IO + git; silent catches |
| 4 | `src/batch/worker-host.mjs` | 602 | Stall loop + launch classification |
| 5 | `src/batch/engine-lanes.mjs` | 568 | Worker + salvage + merge hot path |
| 6 | `src/batch/review.mjs` | 589 | Fail-closed review (adjacent reliability) |
| 7 | `src/batch/state.mjs` | 522 | Circular import; ghost cleanup |
| 8 | `src/batch/orphan-detect.mjs` | 146 | PID-less blind spot |
| 9 | `src/batch/diagnosis.mjs` | 280 | Taxonomy collapse (`needs_retry`) |
| 10 | `src/batch/agent-session-worker.mjs` | 285 | Silent abort catch |

---

## Recommended remediation tasks (SP-109+)

| ID | Title | Priority | Deps |
|----|-------|----------|------|
| **SP-109** | Split `resume-multi.mjs` — validate / lane-run / merge modules | P1 | — |
| **SP-110** | Orphan detect: PID-less ghost `running` + regression fixture | P1 | — |
| **SP-111** | Unify detached start/resume `enginePid` persistence + timeout test | P2 | SP-110 |
| **SP-112** | Extract `batch-state-io.mjs`; break state↔reconcile cycle | P2 | — |
| **SP-113** | Diagnosis taxonomy: `worker_orphaned` vs generic `needs_retry` | P2 | SP-110 |
| **SP-114** | Docs sync: CONTEXT Phase 19 Done + incident fixture README | P3 | — |
| **SP-115** | Add `npm run test:batch` script; fix PROMPT baseline command | P3 | — |
| **SP-116** | Reconcile: surface git inspection errors (no empty catch) | P2 | — |
| **SP-117** | Split `detached-start.mjs` (spawn / wait / format) | P3 | SP-111 |
| **SP-118** | Orphan headline enriches from worker output log when no `task.failed` | P2 | SP-113 |

**Suggested wave order:** SP-110 → SP-109 → SP-112 (parallel) → SP-113 → SP-111 → docs SP-114/SP-115

---

## Ready for next remediation wave?

**YES** — core batch reliability fixes from Phases 11–19 are landed and green (258/258 batch tests). The next wave should target **god-file decomposition**, **orphan edge cases**, and **docs/command hygiene** before new feature work on batch orchestration.

---

## Audit metadata

- **Reviewer:** SP-106 autonomous audit  
- **Rules applied:** `.cursor/rules/javascript-3-brutal-audit.mdc` Sections A (anti-patterns), D (error handling), E (state integrity), X (reporting format)  
- **Production changes:** None (read-only audit)
