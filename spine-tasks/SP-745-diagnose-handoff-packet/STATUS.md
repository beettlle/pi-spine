# SP-745: Diagnose handoff packet background + assessmentReason — Status

**Current Step:** 4
**Status:** 🔄 In Progress — Step 4 (Documentation & Delivery)
**Last Updated:** 2026-09-04
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map `buildDiagnosisOutput` return shape and callers
- [x] Map human `--diagnose` and `--json` surfaces

---

### Step 1: Additive fields on diagnose output
**Status:** ✅ Complete

- [x] Add `background: string[]`
- [x] Add `assessmentReason: string`
- [x] Preserve existing fields

---

### Step 2: Human CLI + tests
**Status:** ✅ Complete

- [x] Four-role human layout
- [x] `--json` includes new fields
- [x] Tests for needs_retry, orphan taxonomy, needs_integrate

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] lint
- [x] Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] STATUS note if runbook touch deferred to SP-743
- [ ] Create `.DONE`

---

### Completion Criteria

- [ ] JSON + human four-role output
- [ ] Backward compatible
- [ ] Tests for three diagnoses
- [ ] Closes #278
- [ ] `.DONE` created

---

## Preflight Findings (Step 0)

| # | Finding |
|---|---------|
| 1 | `buildDiagnosisOutput(diagnosis, ctx)` (`src/batch/diagnosis.mjs`) returns `{ diagnosis, headline, suggestedCommand, alternatives }`. |
| 2 | Direct callers: `reconcileBatch` (spreads output into reconcile result), `dismissBatch` / `completeBatch` (`lifecycle.mjs`), `buildSupervisorNudgePayload` (`supervisor-spawn.mjs`, picks headline/suggestedCommand). |
| 3 | `--json` path is a passthrough: reconcile result → `buildStatusJson`/`formatStatusJson` (`status-json.mjs`). New fields on `buildDiagnosisOutput` flow into `--json` automatically. |
| 4 | Human surface: `bin/spine-status.mjs` prints Batch/Phase/Diagnosis/Macro header, bare headline, `→ suggestedCommand`, then Alternatives/Signals/Journal hints. No tests pin the diagnose-mode layout; plain (non-diagnose) layout is pinned by `tests/cli/status.test.mjs` and must stay unchanged. |
| 5 | Diagnosis ctx (`buildReconcileDiagnosisContext`) carries: batchId, baseBranch, phase, macroPhase, failedTaskId, exitReason, launchFailureKind, failedTasks, succeededTasks, totalTasks, pendingTaskCount, salvageRetryCommand, gitMerged, enginePid/staleEnginePid/engineStillRunning, engineOrphanCause, postMergeLimbo, integrateGateOpen, tasksRoot, … . Journal hints live on reconcile `signals` (NOT in ctx) → `background` supports optional `ctx.journalHints` passthrough; human CLI already prints journal tail separately. |
| 6 | **Impact analysis (GitNexus): CRITICAL** — `buildDiagnosisOutput` upstream: 4 direct callers, 27 impacted symbols, 9 processes, 3 modules (Batch, Cli, Dashboard; incl. `assembleHandoffData` #279 consumer). Mitigation: change is strictly additive (two new keys appended); existing fields byte-identical; consumers pick known fields only. |

## Implementation Plan

- **Step 1:** Add `buildBackground(diagnosis, ctx)` → `string[]` decision facts (batch, phase/macroPhase, progress, failed task + exitReason, engine facts, tried/salvage command, optional journal hints) and `buildAssessmentReason(diagnosis, ctx)` → evidence-based why-this-enum string per taxonomy with default. `buildDiagnosisOutput` appends `background` and `assessmentReason` after existing keys (backward compatible).
- **Step 2:** `bin/spine-status.mjs`: in `--diagnose` human mode render SBAR roles in order — `Situation:` = headline, `Background:` bullets from `result.background`, `Assessment:` = `diagnosis — assessmentReason`, `Recommendation:` = suggestedCommand. Plain mode byte-identical. Tests (in-scope `tests/batch/diagnosis.test.mjs`): buildDiagnosisOutput unit tests for needs_retry / worker_orphaned / needs_integrate; backward-compat field assertions; human four-role output + `--json` field assertions via `runSpineStatus`.

## Discoveries

| Area | Note |
|------|------|
| GitNexus | Impact on `buildDiagnosisOutput` = CRITICAL (see preflight #6); proceeding per PROMPT's additive mandate; `detect_changes` ran: 0 changed symbols, risk low (hook touched `.spine/rules-manifest.json` — reverted, Do-NOT list). |
| Docs | No runbook edit needed — SP-743 owns handoff quality-bar docs (per PROMPT Step 4). |
| Verification | `npm test` in worker session: 2519/2564 pass; the 45 failures are ALL `nested_batch_spawn_blocked` from `SPINE_IS_WORKER=1` (SP-482 guard — workers must not spawn batch engines). Proven environmental: same failing files pass 20/20 with `env -u SPINE_IS_WORKER`. Contract `testCommand` exits 0 (56/56); consumer suites (status, status-json, reconcile, handoff, issue-draft, dashboard, extensions, postmortem) pass 177/177. |
