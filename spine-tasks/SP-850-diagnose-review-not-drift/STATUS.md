# SP-850: Diagnose: a task in review is not state drift; no `resume --force` while the engine is live — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-11-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `detectBatchStateDrift` and the suggested-command builder; report the blast radius in STATUS
- [x] `rg -n "resume --force" tests/` — every test that asserts the current `state_drift` suggestion is in the Contract or listed in Discoveries for post-integrate `release:check`
- [x] Confirm the review and contract event names in `src/batch/journal.mjs`

**Blast radius (GitNexus, both CRITICAL — additive guards only, files in scope):**

- `detectBatchStateDrift` (`src/batch/journal-rebuild-drift.mjs`): 27 impacted symbols, direct caller `reconcileBatch` (`src/batch/reconcile-batch.mjs`); 12 processes touched (runSpineHandoff, runLaneLogs, openGateFromSalvageEvidence, dashboard `server`, collectEvidenceBundle, writeBatchPostMortem, runSequenceWaveLandLoop, buildIssueDraftBody, runSupervisorMonitorLoop, runSequence, runSpineSequence, buildDashboardSnapshot); modules Batch (direct), Cli/Dashboard (indirect).
- `buildSuggestedCommand` (`src/batch/diagnosis-suggested-command.mjs`): 20 impacted symbols, direct caller `buildDiagnosisOutput` (`src/batch/diagnosis.mjs:331`); reaches completeBatch/dismissBatch lifecycle, CLI status output, dashboard.

**Preflight facts:**

- ctx wiring confirmed: `reconcileBatch` computes `engineStillRunning = enginePid != null && !staleEnginePid` (`reconcile-batch.mjs:401-403`) → `buildReconcileDiagnosisContext` passes it (`reconcile-diagnosis-context.mjs:105`) → `buildDiagnosisOutput` → `buildSuggestedCommand`.
- Event names: reviews emit `review.started` / `review.completed` / `review.failed` with payload `reviewType` ∈ {`code`, `plan`, `final`} (`review-code.mjs:75-87`, `review-plan.mjs:176-188`, `review-step-run.mjs`, final at `review-final.mjs:337` uses `"final"`); contract verify emits `contract.verified` with `payload.ok` / `contract.failed` (`review-final.mjs:143,304`). There is **no** contract-verify "started" event — the in-flight verify window is inferred as "review pipeline event seen, no terminal lifecycle".
- Existing `state_drift` suggestion tests (`tests/batch/spine-diagnosis-state-drift.test.mjs`, `tests/cli/spine-diagnosis-state-drift.test.mjs`) never pass `engineStillRunning`, so a live-engine wait branch added ahead of the current conditions keeps them green. Contract `testCommand` is `npm test` (full suite) — all `resume --force` assertions run in Contract; no `release:check` discovery needed.

### Step 1: Drift skip for open post-`.DONE` work
**Status:** ⬜ Not Started

- [ ] Helper: task has an open review or contract verification in the journal
- [ ] `doneInLane` drift skipped only in that case

### Step 2: Live-engine suggestion
**Status:** ⬜ Not Started

- [ ] `state_drift` + running phase + live engine → `spine wait …`; stale/dead engine unchanged

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Open code / final review and open contract verify → no drift
- [ ] Terminal journal with stale cache → drift
- [ ] Suggested command: live → `spine wait …`; dead/stale → `spine batch resume --force`

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-850-diagnose-review-not-drift/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
